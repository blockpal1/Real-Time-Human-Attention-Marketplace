use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod attention_marketplace {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_basis_points: u16) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.admin.key();
        config.fee_basis_points = fee_basis_points;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn create_task(ctx: Context<CreateTask>, task_id: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        escrow.agent = ctx.accounts.agent.key();
        escrow.task_id = task_id;
        escrow.balance = 0;
        escrow.bump = ctx.bumps.escrow_state;
        Ok(())
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.agent_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.agent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        let escrow = &mut ctx.accounts.escrow_state;
        escrow.balance = escrow.balance.checked_add(amount).unwrap();
        
        Ok(())
    }

    pub fn stream_pay_human(
        ctx: Context<StreamPayHuman>,
        verified_seconds: u64,
        price_per_second: u64,
    ) -> Result<()> {
        // Calculate total payment
        let total_payment = verified_seconds.checked_mul(price_per_second).unwrap();
        
        // Calculate fee
        let fee_bps = ctx.accounts.config.fee_basis_points as u64;
        let fee_amount = total_payment.checked_mul(fee_bps).unwrap().checked_div(10000).unwrap();
        let user_amount = total_payment.checked_sub(fee_amount).unwrap();

        // Check escrow balance
        let escrow = &mut ctx.accounts.escrow_state;
        require!(escrow.balance >= total_payment, ErrorCode::InsufficientFunds);
        
        // Decrement balance
        escrow.balance = escrow.balance.checked_sub(total_payment).unwrap();

        // PDA signer seeds
        let agent_key = escrow.agent;
        let task_id = &escrow.task_id;
        let bump = escrow.bump;
        let seeds = &[
            b"escrow".as_ref(), // Explicit slice cast
            agent_key.as_ref(),
            task_id.as_bytes(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer to User
        if user_amount > 0 {
            let cpi_accounts_user = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: escrow.to_account_info(),
            };
            let cpi_ctx_user = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_user,
                signer,
            );
            token::transfer(cpi_ctx_user, user_amount)?;
        }

        // Transfer Fee to Admin (Router/Treasury)
        if fee_amount > 0 {
             let cpi_accounts_fee = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.fee_treasury.to_account_info(),
                authority: escrow.to_account_info(),
            };
            let cpi_ctx_fee = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_fee,
                signer,
            );
            token::transfer(cpi_ctx_fee, fee_amount)?;
        }

        Ok(())
    }

    pub fn refund_remainder(ctx: Context<RefundRemainder>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_state;
        let amount = escrow.balance;
        require!(amount > 0, ErrorCode::ZeroBalance);

        // PDA signer seeds
        let agent_key = escrow.agent;
        let task_id = &escrow.task_id;
        let bump = escrow.bump;
        let seeds = &[
            b"escrow".as_ref(),
            agent_key.as_ref(),
            task_id.as_bytes(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.agent_token_account.to_account_info(),
            authority: escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        escrow.balance = 0;
        
        Ok(())
    }

    pub fn initialize_fuel_tank(ctx: Context<InitializeFuelTank>) -> Result<()> {
        let fuel_tank = &mut ctx.accounts.fuel_tank;
        fuel_tank.bump = ctx.bumps.fuel_tank;
        Ok(())
    }

    pub fn payout_user(ctx: Context<PayoutUser>, amount: u64) -> Result<()> {
        // Authority check is handled by has_one=authority on config + signer constraint

        let fuel_tank = &ctx.accounts.fuel_tank;
        let bump = fuel_tank.bump;
        let seeds = &[
            b"fuel_tank".as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.fuel_tank_vault.to_account_info(),
            to: ctx.accounts.human_token_account.to_account_info(),
            authority: ctx.accounts.fuel_tank.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 2 + 1,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, MarketConfig>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    
    #[account(
        init,
        payer = agent,
        space = 8 + 32 + (4 + task_id.len()) + 8 + 1,
        seeds = [b"escrow", agent.key().as_ref(), task_id.as_bytes()],
        bump
    )]
    pub escrow_state: Account<'info, EscrowState>,

    #[account(
        init,
        payer = agent,
        token::mint = mint,
        token::authority = escrow_state,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    
    #[account(mut, has_one = agent)]
    pub escrow_state: Account<'info, EscrowState>,
    
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StreamPayHuman<'info> {
    // Authority is the Router verifying the attention
    #[account(mut)]
    pub router: Signer<'info>, 
    
    #[account(
        has_one = authority,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Box<Account<'info, MarketConfig>>,

    #[account(mut)]
    pub escrow_state: Box<Account<'info, EscrowState>>,
    
    #[account(mut)]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub user_token_account: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub fee_treasury: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: We confirm authority matches the config
    #[account(mut, constraint = config.authority == router.key())]
    pub authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RefundRemainder<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    
    #[account(mut, has_one = agent)]
    pub escrow_state: Account<'info, EscrowState>,
    
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeFuelTank<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 1,
        seeds = [b"fuel_tank"],
        bump
    )]
    pub fuel_tank: Account<'info, FuelTank>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = fuel_tank,
        seeds = [b"fuel_tank_vault"],
        bump
    )]
    pub fuel_tank_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PayoutUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>, // Backend Relayer (pays fees)

    #[account(
        has_one = authority,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Box<Account<'info, MarketConfig>>,

    #[account(
        seeds = [b"fuel_tank"],
        bump = fuel_tank.bump
    )]
    pub fuel_tank: Box<Account<'info, FuelTank>>,

    #[account(
        mut, 
        token::authority = fuel_tank,
        seeds = [b"fuel_tank_vault"],
        bump
    )]
    pub fuel_tank_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Recipient wallet
    pub human_user: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority, // KEY: Backend pays for the user's token account
        associated_token::mint = mint,
        associated_token::authority = human_user
    )]
    pub human_token_account: Box<Account<'info, TokenAccount>>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
    pub bump: u8,
}

#[account]
pub struct EscrowState {
    pub agent: Pubkey,
    pub task_id: String,
    pub balance: u64,
    pub bump: u8,
}

#[account]
pub struct FuelTank {
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds in escrow.")]
    InsufficientFunds,
    #[msg("Escrow balance is zero.")]
    ZeroBalance,
}

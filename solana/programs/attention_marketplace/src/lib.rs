use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("AttnMktXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod attention_marketplace {
    use super::*;

    /// Initialize the market configuration
    pub fn initialize_market_config(
        ctx: Context<InitializeMarketConfig>,
        fee_basis_points: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.admin.key();
        config.fee_basis_points = fee_basis_points;
        msg!("Market config initialized with {}bps fee", fee_basis_points);
        Ok(())
    }

    /// Agent deposits USDC into escrow
    pub fn deposit_escrow(ctx: Context<DepositEscrow>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.agent = ctx.accounts.agent.key();
        escrow.balance = escrow.balance.checked_add(amount).unwrap();
        escrow.bump = ctx.bumps.escrow_account;

        // Transfer tokens from agent to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.agent_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.agent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        msg!("Deposited {} to escrow for agent {}", amount, escrow.agent);
        Ok(())
    }

    /// Router settles a verified attention session
    pub fn close_settlement(
        ctx: Context<CloseSettlement>,
        verified_seconds: u64,
        agreed_price_per_second: u64,
        nonce: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        let config = &ctx.accounts.market_config;

        // Calculate payout
        let gross_amount = verified_seconds
            .checked_mul(agreed_price_per_second)
            .unwrap();
        let fee = gross_amount
            .checked_mul(config.fee_basis_points as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let net_amount = gross_amount.checked_sub(fee).unwrap();

        require!(escrow.balance >= gross_amount, ErrorCode::InsufficientEscrow);

        // Deduct from escrow
        escrow.balance = escrow.balance.checked_sub(gross_amount).unwrap();

        // Transfer net to user
        let seeds = &[
            b"escrow",
            escrow.agent.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_wallet.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, net_amount)?;

        msg!(
            "Settlement: {} seconds @ {} = {} (fee: {}), nonce: {}",
            verified_seconds,
            agreed_price_per_second,
            net_amount,
            fee,
            nonce
        );
        Ok(())
    }
}

// --- Accounts ---

#[derive(Accounts)]
pub struct InitializeMarketConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + MarketConfig::INIT_SPACE,
        seeds = [b"market_config"],
        bump
    )]
    pub config: Account<'info, MarketConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", agent.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseSettlement<'info> {
    pub router: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.agent.as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_wallet: Account<'info, TokenAccount>,
    #[account(seeds = [b"market_config"], bump)]
    pub market_config: Account<'info, MarketConfig>,
    pub token_program: Program<'info, Token>,
}

// --- State ---

#[account]
#[derive(InitSpace)]
pub struct EscrowAccount {
    pub agent: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
}

// --- Errors ---

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient escrow balance for this settlement")]
    InsufficientEscrow,
}

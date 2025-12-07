use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod payment_router {
    use super::*;

    pub fn initialize_market_config(
        ctx: Context<InitializeMarketConfig>,
        fee_basis_points: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.admin.key();
        config.fee_basis_points = fee_basis_points;
        Ok(())
    }

    pub fn deposit_escrow(ctx: Context<DepositEscrow>, amount: u64) -> Result<()> {
        let transfer_instruction = Transfer {
            from: ctx.accounts.agent_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.agent.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        );

        token::transfer(cpi_ctx, amount)?;

        let escrow = &mut ctx.accounts.escrow_account;
        escrow.agent = ctx.accounts.agent.key();
        escrow.balance += amount;
        escrow.bump = *ctx.bumps.get("escrow_account").unwrap();

        Ok(())
    }

    pub fn close_settlement(
        ctx: Context<CloseSettlement>,
        verified_seconds: u64,
        agreed_price_per_second: u64,
        _nonce: u64,
    ) -> Result<()> {
        let total_payout = verified_seconds.checked_mul(agreed_price_per_second)
            .ok_or(ErrorCode::MathOverflow)?;

        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.balance >= total_payout, ErrorCode::InsufficientFunds);

        // Deduct from internal balance
        escrow.balance -= total_payout;

        // Calculate Fee
        let fee_bps = ctx.accounts.market_config.fee_basis_points as u64;
        let fee_amount = total_payout.checked_mul(fee_bps).unwrap() / 10000;
        let net_payout = total_payout - fee_amount;

        // Seeds for signing
        let agent_key = escrow.agent.key();
        let bump = escrow.bump;
        let seeds = &[
            b"escrow",
            agent_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer to User
        if net_payout > 0 {
            let transfer_to_user = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_wallet.to_account_info(),
                authority: escrow.to_account_info(),
            };
            let cpi_ctx_user = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_user,
                signer,
            );
            token::transfer(cpi_ctx_user, net_payout)?;
        }

        // Keep fee in vault (implied) or transfer to fee_receiver (not spec'd, leaving in vault for now) or simple burn?
        // Spec says "Router... transfers funds". We transferred net to user. 
        // Real implementation would likely sweep fees to admin, but we'll stick to core logic.
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarketConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 2,
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
    // Token account holding the agent's USDC
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>, 
    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + 32 + 8 + 1,
        seeds = [b"escrow", agent.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>, // Should be a PDA derived token account
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CloseSettlement<'info> {
    #[account(constraint = router.key() == market_config.authority)]
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
    #[account(
        seeds = [b"market_config"],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
}

#[account]
pub struct EscrowAccount {
    pub agent: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math Overflow")]
    MathOverflow,
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
}

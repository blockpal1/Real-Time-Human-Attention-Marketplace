use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz");

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

    pub fn initialize_fee_vault(ctx: Context<InitializeFeeVault>) -> Result<()> {
        let state = &mut ctx.accounts.fee_vault_state;
        state.authority = ctx.accounts.admin.key();
        state.protocol_balance = 0;
        state.total_collected = 0;
        state.bump = ctx.bumps.fee_vault_state;
        Ok(())
    }

    pub fn register_builder(
        ctx: Context<RegisterBuilder>, 
        builder_code: [u8; 32],
    ) -> Result<()> {
        let builder = &mut ctx.accounts.builder_balance;
        builder.builder_code = builder_code;
        builder.wallet = ctx.accounts.builder_wallet.key();
        builder.balance = 0;
        builder.total_earned = 0;
        builder.bump = ctx.bumps.builder_balance;
        Ok(())
    }

    pub fn update_builder_wallet(ctx: Context<UpdateBuilderWallet>) -> Result<()> {
        let builder = &mut ctx.accounts.builder_balance;
        builder.wallet = ctx.accounts.new_wallet.key();
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
        escrow.bump = ctx.bumps.escrow_account;

        Ok(())
    }

    pub fn withdraw_escrow(ctx: Context<WithdrawEscrow>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.balance >= amount, ErrorCode::InsufficientFunds);

        // Seeds for signing
        let agent_key = ctx.accounts.agent.key();
        let bump = escrow.bump;
        let seeds = &[
            b"escrow",
            agent_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_instruction = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.agent_token_account.to_account_info(),
            authority: escrow.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer,
        );

        token::transfer(cpi_ctx, amount)?;

        escrow.balance -= amount;

        Ok(())
    }

    pub fn close_settlement(
        ctx: Context<CloseSettlement>,
        verified_seconds: u64,
        agreed_price_per_second: u64,
        _nonce: u64,
        builder_code_opt: Option<[u8; 32]>, // Optional builder code
    ) -> Result<()> {
        let total_payout = verified_seconds.checked_mul(agreed_price_per_second)
            .ok_or(ErrorCode::MathOverflow)?;

        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.balance >= total_payout, ErrorCode::InsufficientFunds);

        // Deduct from internal balance
        escrow.balance -= total_payout;

        // Calculate Fee
        let fee_bps = ctx.accounts.market_config.fee_basis_points as u64; // e.g. 1500 (15%)
        let fee_amount = total_payout.checked_mul(fee_bps).unwrap() / 10000;
        let net_payout = total_payout - fee_amount;

        // Seeds for Escrow signing
        let agent_key = escrow.agent.key();
        let escrow_bump = escrow.bump;
        let escrow_seeds = &[
            b"escrow",
            agent_key.as_ref(),
            &[escrow_bump],
        ];
        let escrow_signer = &[&escrow_seeds[..]];

        // 1. Transfer Net Payout to User
        if net_payout > 0 {
            let transfer_to_user = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_wallet.to_account_info(),
                authority: escrow.to_account_info(),
            };
            let cpi_ctx_user = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_user,
                escrow_signer,
            );
            token::transfer(cpi_ctx_user, net_payout)?;
        }

        // 2. Transfer Fees to Fee Vault
        if fee_amount > 0 {
            let transfer_to_fee_vault = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
                authority: escrow.to_account_info(),
            };
            let cpi_ctx_fees = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_fee_vault,
                escrow_signer,
            );
            token::transfer(cpi_ctx_fees, fee_amount)?;

            // 3. Update Balances (Protocol vs Builder)
            let protocol_share;
            let builder_share;

            // Logic: 
            // Total Fee is 15% (1500 bps)
            // Protocol gets 12% (1200 bps) -> 12/15 of fee
            // Builder gets 3% (300 bps) -> 3/15 of fee
            // If no builder, Protocol gets full 15%
            
            if let Some(_code) = builder_code_opt {
                // Check if builder account is present and matches code
                if let Some(builder_balance) = &mut ctx.accounts.builder_balance {
                     // Note: You might want to verify builder_balance.builder_code == _code
                     // But strictly relying on the passed Account being correct is also standard Anchor pattern if seeds match.
                     // The seeds ["builder", code] ensure we loaded the right account for that code.

                     builder_share = fee_amount.checked_mul(3).unwrap() / 15;
                     protocol_share = fee_amount - builder_share;

                     builder_balance.balance += builder_share;
                     builder_balance.total_earned += builder_share;
                } else {
                     // Builder code passed but account not provided/valid -> Protocol takes all (safety fallback)
                     protocol_share = fee_amount;
                }
            } else {
                // No builder code -> Protocol takes all
                protocol_share = fee_amount;
            }

            let state = &mut ctx.accounts.fee_vault_state;
            state.protocol_balance += protocol_share;
            state.total_collected += fee_amount; // Track total volume through vault
        }

        Ok(())
    }

    pub fn claim_builder_balance(ctx: Context<ClaimBuilderBalance>) -> Result<()> {
        let builder = &mut ctx.accounts.builder_balance;
        let amount = builder.balance;

        require!(amount > 0, ErrorCode::NothingToClaim);

        // Seeds for Fee Vault Authority
        let bump = ctx.accounts.fee_vault_state.bump;
        let seeds = &[
            b"fee_vault_state",
            &[bump],
        ];
        // Wait, the fee vault authority typically needs its own PDA or use the state PDA if it owns the token account.
        // Let's assume FeeVaultState PDA is the authority.
        let signer = &[&seeds[..]];

        let transfer = Transfer {
            from: ctx.accounts.fee_vault.to_account_info(),
            to: ctx.accounts.builder_wallet.to_account_info(),
            authority: ctx.accounts.fee_vault_state.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer,
            signer,
        );

        token::transfer(cpi_ctx, amount)?;

        builder.balance = 0;
        Ok(())
    }

    pub fn claim_protocol_fees(ctx: Context<ClaimProtocolFees>) -> Result<()> {
        let state = &mut ctx.accounts.fee_vault_state;
        let amount = state.protocol_balance;

        require!(amount > 0, ErrorCode::NothingToClaim);

        // Seeds for signing
        let bump = state.bump;
        let seeds = &[
            b"fee_vault_state",
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let transfer = Transfer {
            from: ctx.accounts.fee_vault.to_account_info(),
            to: ctx.accounts.admin_wallet.to_account_info(),
            authority: state.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer,
            signer,
        );

        token::transfer(cpi_ctx, amount)?;

        state.protocol_balance = 0;
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
pub struct InitializeFeeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 8 + 1,
        seeds = [b"fee_vault_state"],
        bump
    )]
    pub fee_vault_state: Account<'info, FeeVaultState>,
    #[account(
        init,
        payer = admin,
        seeds = [b"fee_vault", fee_vault_state.key().as_ref()], 
        bump,
        token::mint = mint,
        token::authority = fee_vault_state,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, token::Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(builder_code: [u8; 32])]
pub struct RegisterBuilder<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 8 + 8 + 1,
        seeds = [b"builder", builder_code.as_ref()],
        bump
    )]
    pub builder_balance: Account<'info, BuilderBalance>,
    /// CHECK: This is the builder's wallet public key that we are registering.
    pub builder_wallet: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateBuilderWallet<'info> {
    #[account(mut)]
    pub old_wallet: Signer<'info>, // Current wallet must sign
    #[account(
        mut,
        constraint = builder_balance.wallet == old_wallet.key() @ ErrorCode::Unauthorized
    )]
    pub builder_balance: Account<'info, BuilderBalance>,
    /// CHECK: New wallet address
    pub new_wallet: UncheckedAccount<'info>,
}


#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
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
    #[account(
        mut,
        constraint = vault.owner == escrow_account.key() @ ErrorCode::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawEscrow<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"escrow", agent.key().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(
        mut,
        constraint = vault.owner == escrow_account.key() @ ErrorCode::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(verified_seconds: u64, agreed_price_per_second: u64, nonce: u64, builder_code_opt: Option<[u8; 32]>)]
pub struct CloseSettlement<'info> {
    #[account(constraint = router.key() == market_config.authority)]
    pub router: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.agent.as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    #[account(
        mut,
        constraint = vault.owner == escrow_account.key() @ ErrorCode::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_wallet: Account<'info, TokenAccount>,
    
    // Fee Vault Accounts
    #[account(
        mut,
        seeds = [b"fee_vault_state"],
        bump = fee_vault_state.bump
    )]
    pub fee_vault_state: Account<'info, FeeVaultState>,
    #[account(
        mut,
        constraint = fee_vault.owner == fee_vault_state.key()
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    
    // Optional Builder Balance (only needed if builder_code provided)
    #[account(
        mut,
        seeds = [b"builder", builder_code_opt.unwrap_or([0; 32]).as_ref()],
        bump = builder_balance.bump
    )]
    pub builder_balance: Option<Account<'info, BuilderBalance>>,

    #[account(
        seeds = [b"market_config"],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimBuilderBalance<'info> {
    #[account(mut)]
    pub builder_wallet: Signer<'info>,
    #[account(
        mut,
        constraint = builder_balance.wallet == builder_wallet.key() @ ErrorCode::Unauthorized,
        seeds = [b"builder", builder_balance.builder_code.as_ref()],
        bump = builder_balance.bump
    )]
    pub builder_balance: Account<'info, BuilderBalance>,
    
    #[account(
        mut,
        seeds = [b"fee_vault_state"],
        bump = fee_vault_state.bump
    )]
    pub fee_vault_state: Account<'info, FeeVaultState>,
    #[account(
        mut,
        constraint = fee_vault.owner == fee_vault_state.key()
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimProtocolFees<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        constraint = fee_vault_state.authority == admin.key() @ ErrorCode::Unauthorized,
        seeds = [b"fee_vault_state"],
        bump = fee_vault_state.bump
    )]
    pub fee_vault_state: Account<'info, FeeVaultState>,
    #[account(
        mut,
        constraint = fee_vault.owner == fee_vault_state.key()
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_wallet: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
}

#[account]
pub struct FeeVaultState {
    pub authority: Pubkey,
    pub protocol_balance: u64,
    pub total_collected: u64,
    pub bump: u8,
}

#[account]
pub struct BuilderBalance {
    pub builder_code: [u8; 32],
    pub wallet: Pubkey,
    pub balance: u64,
    pub total_earned: u64,
    pub bump: u8,
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
    #[msg("Invalid vault account - must be owned by escrow PDA")]
    InvalidVault,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("No funds to claim")]
    NothingToClaim,
}

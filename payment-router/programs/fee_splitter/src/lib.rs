use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("FeeSpL1tXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

/// Fee Splitter Program
/// 
/// Splits incoming USDC payments between the Attentium treasury and a referrer.
/// Used by the x402 Payment Protocol when X-Referrer-Agent header is present.
/// 
/// Split: 80% Treasury, 20% Referrer (configurable via referrer_bps)

#[program]
pub mod fee_splitter {
    use super::*;

    /// Initialize the splitter config
    /// Only needs to be called once by the admin
    pub fn initialize(
        ctx: Context<Initialize>,
        treasury: Pubkey,
        default_referrer_bps: u16,
    ) -> Result<()> {
        require!(default_referrer_bps <= 5000, SplitterError::InvalidBps); // Max 50%
        
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = treasury;
        config.default_referrer_bps = default_referrer_bps;
        config.total_split = 0;
        config.bump = ctx.bumps.config;
        
        msg!("Fee Splitter initialized. Treasury: {}, Referrer BPS: {}", 
             treasury, default_referrer_bps);
        
        Ok(())
    }

    /// Split an incoming payment between treasury and referrer
    /// 
    /// # Arguments
    /// * `amount` - Total USDC amount to split (in smallest units)
    /// * `referrer_bps` - Basis points for referrer (e.g., 2000 = 20%)
    pub fn split_payment(
        ctx: Context<SplitPayment>,
        amount: u64,
        referrer_bps: u16,
    ) -> Result<()> {
        require!(referrer_bps <= 5000, SplitterError::InvalidBps); // Max 50%
        require!(amount > 0, SplitterError::ZeroAmount);
        
        // Calculate split
        let referrer_amount = (amount as u128)
            .checked_mul(referrer_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        
        let treasury_amount = amount.checked_sub(referrer_amount).unwrap();
        
        msg!("Splitting {} total: {} to treasury, {} to referrer ({} bps)",
             amount, treasury_amount, referrer_amount, referrer_bps);
        
        // Transfer to treasury
        if treasury_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.source_token.to_account_info(),
                to: ctx.accounts.treasury_token.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, treasury_amount)?;
        }
        
        // Transfer to referrer
        if referrer_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.source_token.to_account_info(),
                to: ctx.accounts.referrer_token.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, referrer_amount)?;
        }
        
        // Update stats
        let config = &mut ctx.accounts.config;
        config.total_split = config.total_split.checked_add(amount).unwrap_or(u64::MAX);
        
        emit!(PaymentSplit {
            payer: ctx.accounts.payer.key(),
            referrer: ctx.accounts.referrer_token.owner,
            total_amount: amount,
            treasury_amount,
            referrer_amount,
            referrer_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Update the treasury address (admin only)
    pub fn update_treasury(ctx: Context<UpdateConfig>, new_treasury: Pubkey) -> Result<()> {
        ctx.accounts.config.treasury = new_treasury;
        msg!("Treasury updated to: {}", new_treasury);
        Ok(())
    }

    /// Update the default referrer BPS (admin only)
    pub fn update_default_bps(ctx: Context<UpdateConfig>, new_bps: u16) -> Result<()> {
        require!(new_bps <= 5000, SplitterError::InvalidBps);
        ctx.accounts.config.default_referrer_bps = new_bps;
        msg!("Default referrer BPS updated to: {}", new_bps);
        Ok(())
    }
}

// ============================================
// ACCOUNTS
// ============================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + SplitterConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, SplitterConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SplitPayment<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, SplitterConfig>,
    
    /// The payer who is sending the USDC
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// Payer's USDC token account (source)
    #[account(
        mut,
        constraint = source_token.owner == payer.key()
    )]
    pub source_token: Account<'info, TokenAccount>,
    
    /// Treasury's USDC token account
    #[account(mut)]
    pub treasury_token: Account<'info, TokenAccount>,
    
    /// Referrer's USDC token account
    #[account(mut)]
    pub referrer_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ SplitterError::Unauthorized
    )]
    pub config: Account<'info, SplitterConfig>,
    
    pub authority: Signer<'info>,
}

// ============================================
// STATE
// ============================================

#[account]
#[derive(InitSpace)]
pub struct SplitterConfig {
    /// Admin authority who can update config
    pub authority: Pubkey,
    
    /// Main treasury wallet
    pub treasury: Pubkey,
    
    /// Default referrer share in basis points (2000 = 20%)
    pub default_referrer_bps: u16,
    
    /// Total USDC amount split through this program
    pub total_split: u64,
    
    /// PDA bump
    pub bump: u8,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct PaymentSplit {
    pub payer: Pubkey,
    pub referrer: Pubkey,
    pub total_amount: u64,
    pub treasury_amount: u64,
    pub referrer_amount: u64,
    pub referrer_bps: u16,
    pub timestamp: i64,
}

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum SplitterError {
    #[msg("Referrer BPS cannot exceed 5000 (50%)")]
    InvalidBps,
    
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    
    #[msg("Unauthorized: Only authority can perform this action")]
    Unauthorized,
}

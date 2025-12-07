/**
 * Solana Anchor Program Interface Design for Attention Marketplace
 * This represents the IDL (Interface Description Language) logic.
 */

export interface AttentionMarketplaceProgram {
    version: "0.1.0";
    name: "attention_marketplace";
    instructions: [
        {
            name: "initialize_market_config";
            accounts: [
                { name: "admin"; isMut: true; isSigner: true },
                { name: "config"; isMut: true; isSigner: true },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "fee_basis_points"; type: "u16" } // e.g. 500 = 5%
            ];
        },
        {
            name: "deposit_escrow";
            docs: ["Agent deposits USDC into an escrow account to fund bids."];
            accounts: [
                { name: "agent"; isMut: true; isSigner: true },
                { name: "escrowAccount"; isMut: true; isSigner: false },
                { name: "mint"; isMut: false; isSigner: false }, // USDC Mint
                { name: "vault"; isMut: true; isSigner: false }, // Program Token Account
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "amount"; type: "u64" }
            ];
        },
        {
            name: "close_settlement";
            docs: ["Router verifies attention logs and transfers funds from Escrow -> User."];
            accounts: [
                { name: "router"; isMut: false; isSigner: true }, // The authority key
                { name: "escrowAccount"; isMut: true; isSigner: false },
                { name: "vault"; isMut: true; isSigner: false },
                { name: "userWallet"; isMut: true; isSigner: false }, // Recipient
                { name: "marketConfig"; isMut: false; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "verified_seconds"; type: "u64" },
                { name: "agreed_price_per_second"; type: "u64" },
                { name: "nonce"; type: "u64" } // Prevent replay
            ];
        }
    ];
    accounts: [
        {
            name: "EscrowAccount";
            type: {
                kind: "struct";
                fields: [
                    { name: "agent"; type: "publicKey" },
                    { name: "balance"; type: "u64" },
                    { name: "bump"; type: "u8" }
                ];
            };
        },
        {
            name: "MarketConfig";
            type: {
                kind: "struct";
                fields: [
                    { name: "authority"; type: "publicKey" }, // Router Key
                    { name: "fee_basis_points"; type: "u16" }
                ];
            };
        }
    ];
}

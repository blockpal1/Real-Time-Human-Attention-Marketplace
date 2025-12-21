#!/usr/bin/env python3
"""
Attentium x402 Client

A command-line client for interacting with the Attentium verification API
using the x402 Payment Protocol (HTTP 402).

Usage:
    python attentium_client.py --duration 30 --bid 0.05
    python attentium_client.py --duration 30 --bid 0.05 --referrer <WALLET_ADDRESS>
    python attentium_client.py --duration 30 --bid 0.05 --dry-run

Requirements:
    pip install requests solana solders
"""

import argparse
import json
import sys
import uuid
from typing import Optional

import requests

# Try to import Solana libraries (optional for dry-run mode)
try:
    from solana.rpc.api import Client as SolanaClient
    from solana.transaction import Transaction
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from spl.token.instructions import transfer_checked, TransferCheckedParams
    SOLANA_AVAILABLE = True
except ImportError:
    SOLANA_AVAILABLE = False
    print("Warning: Solana libraries not installed. Use --dry-run mode or install with:")
    print("  pip install solana solders spl-token")

# Configuration
API_URL = "http://localhost:3000/v1"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # Mainnet USDC
USDC_DECIMALS = 6

# Allowed durations
ALLOWED_DURATIONS = [10, 30, 60]


def calculate_total(duration: int, bid_per_second: float) -> float:
    """Calculate total escrow required."""
    return duration * bid_per_second


# Memo Program for payment binding
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


def generate_campaign_id() -> str:
    """Generate unique campaign identifier for memo binding."""
    return str(uuid.uuid4())


def create_memo_instruction(campaign_id: str):
    """
    Create Memo Program instruction with campaign_id.
    Returns a Solders Instruction object.
    """
    if not SOLANA_AVAILABLE:
        raise RuntimeError("Solana libraries not installed")
    from solders.instruction import Instruction
    return Instruction(
        program_id=Pubkey.from_string(MEMO_PROGRAM_ID),
        accounts=[],  # Memo program requires no accounts
        data=campaign_id.encode('utf-8')
    )


def request_payment_invoice(
    duration: int,
    bid_per_second: float,
    referrer: Optional[str] = None
) -> dict:
    """
    Request a payment invoice from the API.
    Returns the 402 response with payment details.
    """
    headers = {"Content-Type": "application/json"}
    
    if referrer:
        headers["X-Referrer-Agent"] = referrer
    
    payload = {
        "duration": duration,
        "bid_per_second": bid_per_second
    }
    
    response = requests.post(
        f"{API_URL}/verify",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 402:
        return response.json()
    elif response.status_code == 400:
        print(f"Error: {response.json()}")
        sys.exit(1)
    else:
        print(f"Unexpected response: {response.status_code}")
        print(response.text)
        sys.exit(1)


def submit_with_payment(
    duration: int,
    bid_per_second: float,
    tx_signature: str,
    campaign_id: str,
    referrer: Optional[str] = None,
    validation_question: Optional[str] = None,
    content_url: Optional[str] = None
) -> dict:
    """
    Submit verification request with payment proof.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Solana-Tx-Signature": tx_signature,
        "X-Campaign-Id": campaign_id
    }
    
    if referrer:
        headers["X-Referrer-Agent"] = referrer
    
    payload = {
        "duration": duration,
        "bid_per_second": bid_per_second,
        "validation_question": validation_question or "Is this content appropriate?",
        "content_url": content_url
    }
    
    response = requests.post(
        f"{API_URL}/verify",
        headers=headers,
        json=payload
    )
    
    return response.json()


def create_usdc_transfer(
    keypair_path: str,
    recipient: str,
    amount_usdc: float,
    campaign_id: str,
    rpc_url: str = "https://api.mainnet-beta.solana.com"
) -> str:
    """
    Create and send a USDC transfer transaction with memo.
    Returns the transaction signature.
    """
    if not SOLANA_AVAILABLE:
        raise RuntimeError("Solana libraries not installed")
    
    # Load keypair
    with open(keypair_path, 'r') as f:
        keypair_data = json.load(f)
    keypair = Keypair.from_bytes(bytes(keypair_data))
    
    # Initialize client
    client = SolanaClient(rpc_url)
    
    # Calculate amount in lamports (USDC has 6 decimals)
    amount_lamports = int(amount_usdc * (10 ** USDC_DECIMALS))
    
    # Get token accounts
    # Note: This is simplified - production code should handle ATAs properly
    sender_pubkey = keypair.pubkey()
    recipient_pubkey = Pubkey.from_string(recipient)
    mint_pubkey = Pubkey.from_string(USDC_MINT)
    
    # Create transfer instruction
    transfer_ix = transfer_checked(
        TransferCheckedParams(
            program_id=Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            source=sender_pubkey,  # Should be sender's USDC ATA
            mint=mint_pubkey,
            dest=recipient_pubkey,  # Should be recipient's USDC ATA
            owner=sender_pubkey,
            amount=amount_lamports,
            decimals=USDC_DECIMALS
        )
    )
    
    # Create memo instruction for payment binding
    memo_ix = create_memo_instruction(campaign_id)
    
    # Build and send transaction (transfer + memo)
    recent_blockhash = client.get_latest_blockhash().value.blockhash
    tx = Transaction.new_signed_with_payer(
        [transfer_ix, memo_ix],
        keypair.pubkey(),
        [keypair],
        recent_blockhash
    )
    
    result = client.send_transaction(tx)
    return str(result.value)


def main():
    parser = argparse.ArgumentParser(
        description="Attentium x402 Client - Submit verification requests with payment"
    )
    
    parser.add_argument(
        "--duration",
        type=int,
        required=True,
        choices=ALLOWED_DURATIONS,
        help="Duration in seconds (10, 30, or 60)"
    )
    
    parser.add_argument(
        "--bid",
        type=float,
        required=True,
        help="Bid per second in USDC (min: 0.0001)"
    )
    
    parser.add_argument(
        "--referrer",
        type=str,
        default=None,
        help="Optional referrer wallet address for revenue share"
    )
    
    parser.add_argument(
        "--keypair",
        type=str,
        default=None,
        help="Path to Solana keypair JSON file"
    )
    
    parser.add_argument(
        "--rpc",
        type=str,
        default="https://api.mainnet-beta.solana.com",
        help="Solana RPC URL"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show payment invoice, don't submit transaction"
    )
    
    parser.add_argument(
        "--tx-signature",
        type=str,
        default=None,
        help="Use existing transaction signature instead of creating new one"
    )
    
    parser.add_argument(
        "--api-url",
        type=str,
        default=API_URL,
        help="API base URL"
    )
    
    args = parser.parse_args()
    
    # Update global API URL if provided
    global API_URL
    API_URL = args.api_url
    
    # Validate bid
    if args.bid < 0.0001:
        print("Error: Bid must be >= $0.0001/second")
        sys.exit(1)
    
    # Calculate total
    total = calculate_total(args.duration, args.bid)
    
    print(f"\n{'='*50}")
    print("ATTENTIUM x402 CLIENT")
    print(f"{'='*50}")
    print(f"Duration:        {args.duration} seconds")
    print(f"Bid per second:  ${args.bid}")
    print(f"Total escrow:    ${total:.6f} USDC")
    if args.referrer:
        print(f"Referrer:        {args.referrer[:12]}...{args.referrer[-4:]}")
    print(f"{'='*50}\n")
    
    # Generate unique campaign ID for memo binding
    campaign_id = generate_campaign_id()
    
    # Step 1: Get payment invoice
    print("[1/4] Requesting payment invoice...")
    invoice = request_payment_invoice(args.duration, args.bid, args.referrer)
    print(f"   Campaign ID: {campaign_id}")
    
    print(f"\n📄 PAYMENT INVOICE")
    print(f"   Chain:     {invoice['payment']['chain']}")
    print(f"   Token:     {invoice['payment']['token']}")
    print(f"   Amount:    ${invoice['payment']['amount']} USDC")
    print(f"   Recipient: {invoice['payment']['recipient'][:20]}...")
    
    if 'instruction_data' in invoice['payment']:
        print(f"\n   Revenue Share:")
        print(f"   └─ Referrer: {invoice['payment']['instruction_data']['referrer'][:12]}...")
        print(f"   └─ Share:    {invoice['payment']['instruction_data']['referrer_bps'] / 100}%")
    
    if args.dry_run:
        print("\n✅ DRY RUN - Invoice received, no transaction submitted")
        print("\nTo complete payment, run again with --keypair or --tx-signature")
        return
    
    # Step 2: Create or use existing transaction
    tx_signature = args.tx_signature
    
    if not tx_signature:
        if not args.keypair:
            print("\n❌ Error: --keypair or --tx-signature required (not in dry-run mode)")
            sys.exit(1)
        
        if not SOLANA_AVAILABLE:
            print("\n❌ Error: Solana libraries not installed")
            print("   Install with: pip install solana solders spl-token")
            sys.exit(1)
        
        print(f"\n[2/4] Creating USDC transfer with memo...")
        try:
            tx_signature = create_usdc_transfer(
                args.keypair,
                invoice['payment']['recipient'],
                invoice['payment']['amount'],
                campaign_id,
                args.rpc
            )
            print(f"   ✅ Transaction sent: {tx_signature[:20]}...")
            print(f"   📝 Memo: {campaign_id[:8]}...")
        except Exception as e:
            print(f"   ❌ Transaction failed: {e}")
            sys.exit(1)
    else:
        print(f"\n[2/4] Using existing transaction: {tx_signature[:20]}...")
        print(f"       ⚠️  Make sure the transaction includes memo: {campaign_id}")
    
    # Wait for confirmation
    print(f"\n[3/4] Waiting for transaction confirmation...")
    import time
    time.sleep(3)  # Brief wait for finality
    
    # Step 4: Submit with payment proof
    print(f"\n[4/4] Submitting verification with payment proof...")
    result = submit_with_payment(args.duration, args.bid, tx_signature, campaign_id, args.referrer)
    
    if result.get('success'):
        print(f"\n{'='*50}")
        print("✅ VERIFICATION SUCCESSFUL")
        print(f"{'='*50}")
        print(f"   Duration:   {result['order']['duration']}s")
        print(f"   Bid:        ${result['order']['bid_per_second']}/s")
        print(f"   Total:      ${result['order']['total_escrow']} USDC")
        print(f"   TX Hash:    {result['order']['tx_hash'][:20]}...")
        print(f"   Payer:      {result['order']['payer'][:20]}...")
        if result['order'].get('referrer'):
            print(f"   Referrer:   {result['order']['referrer'][:20]}...")
    else:
        print(f"\n❌ Verification failed:")
        print(json.dumps(result, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()

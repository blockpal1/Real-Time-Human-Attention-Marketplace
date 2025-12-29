import { Router } from 'express';
import { BuilderController } from '../controllers/BuilderController';

const router = Router();

/**
 * Get on-chain balance and lifetime earnings for a builder code
 * GET /v1/builders/:code/balance
 */
router.get('/:code/balance', BuilderController.getBalance);

/**
 * Get unsigned transaction to claim builder earnings
 * POST /v1/builders/:code/claim
 * Body: { wallet: "Pubkey" }
 */
router.post('/:code/claim', BuilderController.createClaimTransaction);

/**
 * Get unsigned transaction to update builder wallet
 * POST /v1/builders/:code/update-wallet
 * Body: { oldWallet: "Pubkey", newWallet: "Pubkey" }
 */
router.post('/:code/update-wallet', BuilderController.updateWalletTransaction);

export default router;

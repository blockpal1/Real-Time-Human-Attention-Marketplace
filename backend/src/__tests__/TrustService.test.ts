/**
 * Unit Tests for TrustService
 * Run with: npm test
 */
import { validateResponseWithAI, updateSignalQuality, getWorkerStatus } from '../services/TrustService';
import { redisClient } from '../utils/redis';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock Redis
jest.mock('../utils/redis', () => ({
    redisClient: {
        client: {
            hGetAll: jest.fn(),
            hSet: jest.fn(),
            hGet: jest.fn(),
        }
    }
}));

describe('TrustService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateResponseWithAI', () => {
        it('should return true when AI returns PASS', async () => {
            mockOpenAI.prototype.chat = {
                completions: {
                    create: jest.fn().mockResolvedValue({
                        choices: [{ message: { content: 'PASS' } }]
                    })
                }
            } as any;

            const result = await validateResponseWithAI('Is there a cat?', 'yes');
            expect(result).toBe(true);
        });

        it('should return false when AI returns FAIL', async () => {
            mockOpenAI.prototype.chat = {
                completions: {
                    create: jest.fn().mockResolvedValue({
                        choices: [{ message: { content: 'FAIL' } }]
                    })
                }
            } as any;

            const result = await validateResponseWithAI('Describe the image', 'asdf');
            expect(result).toBe(false);
        });

        it('should fail-open (return true) on API error', async () => {
            mockOpenAI.prototype.chat = {
                completions: {
                    create: jest.fn().mockRejectedValue(new Error('API Error'))
                }
            } as any;

            const result = await validateResponseWithAI('Question', 'Answer');
            expect(result).toBe(true);
        });

        it('should return true for empty answers', async () => {
            const result = await validateResponseWithAI('Question', '');
            expect(result).toBe(true);
        });
    });

    describe('updateSignalQuality', () => {
        it('should initialize new user at quality 50', async () => {
            (redisClient.client.hGetAll as jest.Mock).mockResolvedValue({});
            (redisClient.client.hSet as jest.Mock).mockResolvedValue(undefined);

            const result = await updateSignalQuality('wallet123', true);

            expect(redisClient.client.hSet).toHaveBeenCalledWith(
                'user:wallet123',
                { quality: '50', lastActive: expect.any(String) }
            );
            expect(result).toBe('HIGH_SIGNAL');
        });

        it('should increase quality by 1 on PASS', async () => {
            (redisClient.client.hGetAll as jest.Mock).mockResolvedValue({
                quality: '50',
                lastActive: String(Date.now())
            });

            await updateSignalQuality('wallet123', true);

            expect(redisClient.client.hSet).toHaveBeenCalledWith(
                'user:wallet123',
                { quality: '51', lastActive: expect.any(String) }
            );
        });

        it('should decrease quality by 10 on FAIL', async () => {
            (redisClient.client.hGetAll as jest.Mock).mockResolvedValue({
                quality: '50',
                lastActive: String(Date.now())
            });

            const result = await updateSignalQuality('wallet123', false);

            expect(redisClient.client.hSet).toHaveBeenCalledWith(
                'user:wallet123',
                { quality: '40', lastActive: expect.any(String) }
            );
            expect(result).toBe('LOW_SIGNAL');
        });

        it('should return BANNED when quality drops below 20', async () => {
            (redisClient.client.hGetAll as jest.Mock).mockResolvedValue({
                quality: '25',
                lastActive: String(Date.now())
            });

            const result = await updateSignalQuality('wallet123', false);

            expect(result).toBe('BANNED');
        });

        it('should apply time decay (1 point per day)', async () => {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            (redisClient.client.hGetAll as jest.Mock).mockResolvedValue({
                quality: '50',
                lastActive: String(sevenDaysAgo)
            });

            await updateSignalQuality('wallet123', true);

            // 50 - 7 (decay) + 1 (reward) = 44
            expect(redisClient.client.hSet).toHaveBeenCalledWith(
                'user:wallet123',
                { quality: '44', lastActive: expect.any(String) }
            );
        });
    });

    describe('getWorkerStatus', () => {
        it('should return current quality and ban status', async () => {
            (redisClient.client.hGet as jest.Mock).mockResolvedValue('75');

            const result = await getWorkerStatus('wallet123');

            expect(result).toEqual({ quality: 75, isBanned: false });
        });

        it('should return default 50 for new users', async () => {
            (redisClient.client.hGet as jest.Mock).mockResolvedValue(null);

            const result = await getWorkerStatus('wallet123');

            expect(result).toEqual({ quality: 50, isBanned: false });
        });

        it('should mark as banned when quality < 20', async () => {
            (redisClient.client.hGet as jest.Mock).mockResolvedValue('15');

            const result = await getWorkerStatus('wallet123');

            expect(result).toEqual({ quality: 15, isBanned: true });
        });
    });
});

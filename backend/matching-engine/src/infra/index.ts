export { redisManager, getRedisClient, createBlockingClient } from './redis-client';
export type { RedisConfig } from './redis-client';

export * from './stream-keys';

export { StreamConsumer } from './consumer';
export type { StreamMessage, ConsumerOptions } from './consumer';

export { StreamProducer, getProducer, emitEvent } from './producer';
export type { ProducerOptions } from './producer';

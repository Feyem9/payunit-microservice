import CircuitBreaker from 'opossum';
import logger from './logger';

const options = {
  timeout: 15000,
  errorThresholdPercentage: 100, // Désactivé en pratique — n'ouvre que si 100% échouent
  resetTimeout: 5000,
  volumeThreshold: 50,           // Nécessite 50 appels avant d'évaluer
};

// Crée un circuit breaker autour d'une fonction async
export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  name: string
): CircuitBreaker {
  const breaker = new CircuitBreaker(fn, options);

  breaker.on('open', () =>
    logger.warn({ circuit: name }, 'Circuit breaker OPEN — PayUnit calls blocked')
  );
  breaker.on('halfOpen', () =>
    logger.info({ circuit: name }, 'Circuit breaker HALF-OPEN — testing PayUnit')
  );
  breaker.on('close', () =>
    logger.info({ circuit: name }, 'Circuit breaker CLOSED — PayUnit recovered')
  );
  breaker.fallback(() => {
    throw new Error('PayUnit service unavailable (circuit open)');
  });

  return breaker;
}

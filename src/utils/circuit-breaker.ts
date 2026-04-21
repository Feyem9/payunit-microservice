import CircuitBreaker from 'opossum';
import logger from './logger';

const options = {
  timeout: 15000,
  errorThresholdPercentage: 60, // Ouvre le circuit si 60% des appels échouent
  resetTimeout: 10000,          // Réessaie après 10s (réduit de 30s)
  volumeThreshold: 10,          // Minimum 10 appels avant d'évaluer
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

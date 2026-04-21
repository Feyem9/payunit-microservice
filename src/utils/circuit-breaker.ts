import CircuitBreaker from 'opossum';
import logger from './logger';

const options = {
  timeout: 15000,           // Considère l'appel échoué après 15s
  errorThresholdPercentage: 50, // Ouvre le circuit si 50% des appels échouent
  resetTimeout: 30000,      // Réessaie après 30s (état half-open)
  volumeThreshold: 5,       // Minimum 5 appels avant d'évaluer le taux d'erreur
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

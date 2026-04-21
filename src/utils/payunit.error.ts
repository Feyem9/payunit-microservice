import axios from 'axios';

export interface PayUnitErrorDetail {
  message: string;
  statusCode?: number;
  upstream?: unknown;
}

/**
 * Extrait un message d'erreur lisible depuis une erreur axios (réponse PayUnit)
 * ou une erreur générique.
 */
export function extractPayUnitError(error: unknown): PayUnitErrorDetail {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    // Timeout
    if (error.code === 'ECONNABORTED') {
      return { message: 'PayUnit API timeout', statusCode: 504 };
    }

    // Pas de réponse (réseau)
    if (!error.response) {
      return { message: 'PayUnit API unreachable', statusCode: 503 };
    }

    // Erreur avec réponse PayUnit
    const upstreamMessage =
      data?.message || data?.error || data?.msg || `PayUnit error ${status}`;

    return {
      message: upstreamMessage,
      statusCode: status && status >= 400 && status < 500 ? 400 : 502,
      upstream: data,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, statusCode: 500 };
  }

  return { message: 'Unknown error', statusCode: 500 };
}

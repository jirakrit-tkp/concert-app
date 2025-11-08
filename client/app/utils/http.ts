export const extractErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.clone().json();
    if (typeof data === 'string') {
      return data;
    }
    if (Array.isArray(data?.message)) {
      return data.message.join(', ');
    }
    if (typeof data?.message === 'string' && data.message.length > 0) {
      return data.message;
    }
  } catch {
    // ignore json parse errors
  }

  try {
    const text = await response.text();
    if (text.length > 0) {
      return text;
    }
  } catch {
    // no-op
  }

  return fallback;
};

export const resolveErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }
  return fallback;
};


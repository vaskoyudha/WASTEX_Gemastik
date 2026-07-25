import { useState, useEffect, useCallback, useRef } from "react";

const EMPTY_ARGS: any[] = [];

export interface UseServiceCallResult<T, Args extends any[] = any[]> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: Args) => Promise<T | null>;
  refetch: () => Promise<T | null>;
  reset: () => void;
}

export function useServiceCall<T, Args extends any[] = any[]>(
  serviceFn: (...args: Args) => Promise<T>,
  options: {
    autoCall?: boolean;
    initialArgs?: Args;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
): UseServiceCallResult<T, Args> {
  const { autoCall = false, onSuccess, onError } = options;
  const initialArgs = options.initialArgs ?? (EMPTY_ARGS as Args);
  const initialArgsRef = useRef(initialArgs);

  useEffect(() => {
    initialArgsRef.current = initialArgs;
  }, [initialArgs]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(autoCall);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      initialArgsRef.current = args;
      setLoading(true);
      setError(null);
      try {
        const result = await serviceFn(...args);
        setData(result);
        if (onSuccess) {
          onSuccess(result);
        }
        return result;
      } catch (err: any) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        if (onError) {
          onError(e);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [serviceFn, onSuccess, onError]
  );

  const refetch = useCallback(() => {
    return execute(...initialArgsRef.current);
  }, [execute]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (autoCall) {
      execute(...initialArgsRef.current);
    }
  }, [autoCall, execute, initialArgs]);

  return {
    data,
    loading,
    error,
    execute,
    refetch,
    reset,
  };
}

// The component that owns the write shows its failure itself, so the global
// mutation error toast must stay off. Spread it into the mutation options.
export const mutationMeta = { meta: { suppressGlobalErrorToast: true } };

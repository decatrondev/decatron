using Xunit;

// Varias pruebas comparten las mismas bases desechables (y una activa RLS en una tabla): se ejecutan en serie.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

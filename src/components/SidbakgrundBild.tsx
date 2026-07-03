// Diskret bakgrundsbild (körsbärsträdet på gården) bakom sidinnehållet.
// Placeras som första barn i en `position: relative; overflow: hidden`-
// behållare. Startsidan har sin egen variant med tulpaner, se src/app/page.tsx.
export function SidbakgrundBild() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/images/korsbarstrad.webp')] bg-cover bg-top opacity-42"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-stone-50/30 via-stone-50/80 to-stone-50"
        aria-hidden="true"
      />
    </>
  );
}

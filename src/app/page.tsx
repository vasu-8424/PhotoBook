import { createEmptyDesign } from "@/lib/layout/create-design";

export default function Home() {
  const a4 = createEmptyDesign("A4");

  const square = createEmptyDesign("SQUARE_210");

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        Memory Magazine
      </h1>

      <p className="mt-2 text-gray-600">
        Part 1 foundation test
      </p>

      <pre className="mt-8 overflow-auto rounded-lg bg-gray-100 p-6 text-sm">
        {JSON.stringify(
          {
            a4,
            square,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}

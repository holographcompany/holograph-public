// /app/maintenance/page.tsx

export default function MaintenancePage() {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-6">
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold mb-4">🚧 Site Under Maintenance</h1>
          <p className="text-lg text-gray-700">
            The Holograph app is currently offline while we make some improvements.
            <br />
            Please check back soon. Thank you for your patience.
          </p>
        </div>
      </main>
    );
  }
  
import { MainDashboard } from '@/components/dashboard/main-dashboard';
import { R2Uploader } from '@/components/R2Uploader';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10 space-y-10">
      <MainDashboard />
      <section>
        <R2Uploader />
      </section>
    </main>
  );
}

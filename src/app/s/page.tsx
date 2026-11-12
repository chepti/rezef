import { Suspense } from "react";
import StudentHome from "@/components/StudentHome";

async function HomeLoader({ searchParams }: { searchParams: PageProps<"/s">["searchParams"] }) {
  const sp = await searchParams;
  return <StudentHome error={typeof sp.error === "string" ? sp.error : ""} />;
}

export default function StudentPage(props: PageProps<"/s">) {
  return (
    <Suspense fallback={<div className="p-10 text-muted">טוענים…</div>}>
      <HomeLoader searchParams={props.searchParams} />
    </Suspense>
  );
}

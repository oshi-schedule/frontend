import Link from "next/link";
import { Card } from "@/components/ui/card";

const links = [
  ["/admin/events", "Events"],
  ["/admin/groups", "Groups"],
  ["/admin/venues", "Venues"],
  ["/admin/training-dataset", "Labeling"],
  ["/admin/event-candidate-reviews", "Analytics"],
  ["/admin/ocr-evaluation", "OCR Lab"],
];

export function AdminNav() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {links.map(([href, label]) => (
        <Link key={href} href={href}>
          <Card className="p-2 text-center text-xs font-semibold">{label}</Card>
        </Link>
      ))}
    </div>
  );
}

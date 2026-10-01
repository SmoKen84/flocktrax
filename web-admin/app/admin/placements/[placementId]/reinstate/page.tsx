import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { reinstatePlacementAction } from "./actions";

type Drop = { id: string; ticket_num?: string; placement_id?: string; drop_weight?: number; type?: string };
type Order = { commitment_id: string; external_order_ref?: string; ordered_lbs?: number; received_lbs?: number; status?: string };
export default async function ReinstatePlacementPage({ params, searchParams }: {
  params: Promise<{ placementId: string }>; searchParams: Promise<{ error?: string; date?: string }>;
}) {
  const { placementId } = await params;
  const { error, date } = await searchParams;
  const admin = createSupabaseAdminClient();
  const client = await createSupabaseServerClient();
  const actorId = (await client?.auth.getUser())?.data.user?.id;
  const result = admin && actorId ? await admin.rpc("preview_placement_reinstatement", {
    p_placement_id: placementId, p_placement_date: date || null, p_actor_id: actorId,
  }) : null;
  if (!result || result.error) return <section className="panel card"><h1>Reinstate Flock</h1><p>{result?.error?.message ?? "Sign in to review this flock."}</p><Link href="/admin/placements/new">Return to scheduling</Link></section>;
  const review = result.data;
  const drops = review.drops as Drop[];
  const orders = review.orders as Order[];
  return <>
    <PageHeader eyebrow="Placement Scheduling" title={`Reinstate ${review.placement.placement_key}`}
      body="Choose a placement date, review its feed allocations, then confirm. The flock returns to scheduling; bird arrival remains a separate step." />
    <section className="panel card">
      {error ? <p role="alert">{error}</p> : null}
      <form method="get" action={`/admin/placements/${placementId}/reinstate`}>
        <label className="field"><span>Placement date</span><input type="date" name="date" defaultValue={review.date} required /></label>
        <p>Changing this date shifts the projected end, female/male arrival dates, and scheduled live-haul dates by the same number of days.</p>
        <button className="button-secondary" type="submit">Review This Date</button>
      </form>
      <hr />
      <h2>Review for {review.date}</h2>
      <p>Projected end: {review.end_date}</p>
      {review.blocker ? <p role="alert">{review.blocker}</p> : null}
      {review.move_feed ? <p>The barn is empty and this flock will be placed before {review.next_code}. All existing drops and associated non-canceled feed orders allocated to {review.next_code} will be reassigned to {review.placement.placement_key}. No new feed tickets or drops will be created.</p>
        : <p>{!review.empty_barn ? "This barn is occupied. No feed will be reassigned during reinstatement." : review.next_id ? "This date does not make the reinstated flock the next placement. Existing feed allocations will stay with the current next flock." : "There is no next scheduled placement from which to reassign feed."}</p>}
      {drops.length ? <table><thead><tr><th>Feed ticket</th><th>Allocation</th><th>Feed type</th><th>Pounds</th></tr></thead><tbody>{drops.map(row => <tr key={row.id}>
        <td>{row.ticket_num || row.id}</td><td>{row.placement_id === review.next_id ? "Delivered" : "Queued"}</td><td>{row.type}</td><td>{row.drop_weight?.toLocaleString()}</td>
      </tr>)}</tbody></table> : <p>No feed drops to reassign.</p>}
      {orders.length ? <table><thead><tr><th>Order</th><th>Status</th><th>Outstanding pounds</th></tr></thead><tbody>{orders.map(row => <tr key={row.commitment_id}>
        <td>{row.external_order_ref || row.commitment_id}</td><td>{row.status}</td><td>{Math.max(0, (row.ordered_lbs ?? 0) - (row.received_lbs ?? 0)).toLocaleString()}</td>
      </tr>)}</tbody></table> : null}
      <form action={reinstatePlacementAction}>
        <input type="hidden" name="placement_id" value={placementId} />
        <input type="hidden" name="placement_date" value={review.date} />
        <input type="hidden" name="fingerprint" value={review.fingerprint} />
        <label className="field"><span><input type="checkbox" name="feed_reviewed" value="yes" required /> I confirm the {review.date} placement date and feed allocations shown above.</span></label>
        <div className="placement-scheduler-form-actions"><button className="button" type="submit" disabled={Boolean(review.blocker)}>Reinstate Flock</button>
          <Link className="button-secondary" href={`/admin/placements/new?placement=${placementId}`}>Keep Canceled</Link></div>
      </form>
    </section>
  </>;
}

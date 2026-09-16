"""Regenerate only the two reported decks, leaving unrelated exports untouched."""
import generate_drm_exports as g

payload = g.apply_completed_period(g.load_json_assignment(g.ROOT / 'data/current_payload.js', 'window.CURRENT_PAYLOAD'))
basis = g.current_as_on_label()
sections = [
    (f'Demand SMH Wise - {basis}', *g.table_from_payload(payload['demand'], payload['demand']['columns'], payload['demand']['rows'])),
    (f'PU Staff Current Year - {basis}', *g.table_from_payload(payload['staff'], payload['staff']['columns'], payload['staff']['rows'])),
    (f'PU Non Staff Current Year - {basis}', *g.table_from_payload(payload['nonstaff'], payload['nonstaff']['columns'], payload['nonstaff']['rows'])),
    (f'PU Previous Year Comparison - {basis}', *g.table_from_payload(payload['pu_prev'])),
    (f'Demand Previous Year Comparison - {basis}', *g.table_from_payload(payload['demand_prev'])),
]
period = g.period_from_meta()
g.build_pptx_from_template(g.CURRENT_PPTX, sections, f"Accounts Dept | FY 2026-2027 | Current / Previous Year Budget Analysis | Completed {period['label']}")
g.refresh_yearly_comparison_pptx()
print(g.CURRENT_PPTX)
print(g.DRM_YEARLY_COMPARISON_PPTX)

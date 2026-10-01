ICON Panels - Order Pricing Demo

Open index.html after extracting this ZIP.
All interface assets are HTML, CSS, JavaScript and supplied logo. No custom backend.

The demo includes:
- Multiple 4 cm Wall visible fix 1.0 panel lines, each with independent configuration.
- Add, edit and remove items; generated editable customer descriptions.
- Order costing and profit; aggregated materials in source units.
- Technical/commercial offer with optional entered payment/delivery/validity terms.
- USD source pricing and EGP conversion using a manually entered exchange rate.
- Printable customer offer, excluding internal cost/profit and raw material requirements.
- Draft saving in browser session storage only. No Bitrix requests or writes.

Bitrix integration is not configured. Map client product IDs, source rates,
consumption data and approved custom fields before connecting Deal reads/writes.
The demo does not require the Bitrix Estimate entity.
Use the existing static archive installation flow and BX24 for the final integration.

Pricing limits:
- Only the supplied 4 cm Wall visible fix calculation is implemented.
- Source selling unit is M; other product/unit conversions are not inferred.
- Taxes, transport and production/inventory reservations are excluded.
- Source scrap label 2% uses 1.5% in C1; source formula is preserved.
- PUR adhesion has a charged cost and zero consumption in C1; annotated in materials.
- No exchange rate or client-specific commercial terms are assumed.

Demo frontend only, not a fully connected production Bitrix application.

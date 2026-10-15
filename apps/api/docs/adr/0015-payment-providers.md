# ADR 0015: Payment providers are adapters behind one port

## Context
Sponsorship was written around one vendor. The vendor's name was a default in the database schema and in the configuration, its credentials were environment variables that needed a redeploy to change, the callback route and its payload were parsed in the HTTP layer, the fields of its payment methods (`ratioRange`, `fixedFeeRange`, `desc`) were part of the API, and the web client named and drew payment methods by the vendor's own codes (`wxpay`, `onramp-paypal`). Taking payments through anything else would have meant changes in every layer.

## Decision
A payment provider is known to the rest of the system only as `sponsor.Provider`, the port the sponsorship service consumes:

- `Ready` tells whether the provider has what it needs to take payments. `CreateOrder`, `OrderInfo` and `PayOrder` open an order, read it back and start a payment. `CallbackOrderID` reads which order a callback is about from the raw request, so no payload is parsed outside the adapter. `Method` describes a method id the provider issued.
- A payment method is `{ID, Name, Brand, Fee}`. `ID` is the provider's own and opaque, `Name` is the provider's wording, and `Brand` is one of the brands the domain lists (`alipay`, `wechat_pay`, `paypal`, `google_pay`, `apple_pay`, `usdt`) when the adapter recognises the method. Clients name and draw a method by its brand and fall back to the provider's name; they never see a vendor's code as something to interpret. `Fee` is what the provider charges for paying that way, a rate and a fixed part, each kept in the provider's wording and empty when it charges none: payment aggregators state a fee per method, so it belongs to the port and not to one vendor, and the adapter decides from the vendor's fields what counts as none.
- The service holds its providers by name. A new order goes to the one `Options.Provider` names and remembers that name; reading, paying and settling an order go through the provider that took it, and a provider cannot settle the order of another. An order whose provider is no longer wired is shown as stored.
- Callbacks arrive at `POST /sponsor/webhook/{provider}`. The address given to a provider is built by the composition root from that name.
- Sponsor orders are accepted when the setting `sponsor.enabled` is on and the provider is ready; `GET /sponsor/state` reports the two together and the admin statistics report them apart.
- An adapter declares its own settings in its `settings.go` under the group `payment` and reads them on every call, so credentials are changed in the admin panel and apply at once. iDataRiver has `payment.idatariver_base_url`, `payment.idatariver_project_id` and `payment.idatariver_secret`.
- The name of a vendor appears only in its adapter (`internal/adapter/idatariver`), in the composition root that wires it and in the seeder. `TestVendorsAreNamedOnlyByTheirAdapters` enforces it for every Go file, tests included.

## Alternatives
A separate `payment` capability between sponsorship and the adapters: nothing but sponsorship takes payments, so it would be a layer with one caller. Keeping the credentials in the environment with the settings as an override, as the OIDC and Bangumi credentials do: it leaves the vendor's name in the platform configuration and in the deployment files.

## Consequences
Adding a provider is an adapter that implements the port and declares its settings, one line in the composition root, and a setting to choose between providers once there are two.

## Migration
`IDATARIVER_BASE_URL`, `IDATARIVER_DEVELOPER_SECRET`, `IDATARIVER_PROJECT_ID` and `SPONSOR_PROVIDER` are removed. After deploying, a super admin enters the project id and the developer secret under 「第三方服务」 in the admin settings before switching 「开放赞助」 on. The column `sponsor_orders.provider` loses its default; existing rows keep their value, and the callback address of existing orders (`/sponsor/webhook/idatariver`) is unchanged.

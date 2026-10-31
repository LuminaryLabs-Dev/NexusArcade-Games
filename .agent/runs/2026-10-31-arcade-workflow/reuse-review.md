# Switchyard reuse review against existing games

Scope: source-level comparison at Games commit c162c16b480e81e3044a335f17bb65348a25b8c3, Engine commit4906076837d4020ff2e22fe98723e0922ea6af62 and optional-Kits tree9bd2d6dd459069d8515b4fccb351aa4e26ac5259. No runtime extraction or other-repository changes.

## Directed movement and rear clearance

Switchyard's Train/checkSwitchCommit/updateTransforms and refreshSwitchLocks in games/switchyard/source/src/simulation.mjs use curved path distance, committed branches, a trailing carriage and per-train reservation-clear distances.

Moonline Express, games/moonline-express/source/index.html, uses four x-position thresholds. Its tick function increments x and reads a junction's current mode once, changing an integer lane and setting passed[i]. Its collisions compare equal lanes and x separation. It does not need a route-segment graph, articulated-body history or rear-clear reservations.

Result: both games are railway dispatch, but a shared traversal/reservation Kit is not established by that theme. Keep Switchyard's implementation local. A second actual consist/segment consumer and executable parity fixture are needed before extraction.

Core route-field services own markers, corridors and nearest-marker queries; they are not demonstrated train traversal. Optional generic-route-cargo-extraction-kit and route-clearance-domain-kit manifests are migration placeholders with realBehavior=false, null package exports and no parity proof. They are not usable alternatives merely because their names sound relevant.

## Queue spacing

Switchyard limits physical following distance using path progress and body dimensions. Last Call Café, games/last-call-cafe/source/src/core.mjs, owns customer orders, patience, capacity, recipe steps and fulfillment. Core interaction/request/queue already owns queued-request patience and expiry.

Result: do not force these into one queue abstraction or duplicate Core request handling. Physical spacing remains a candidate without second-consumer proof.

## Dispatch scheduling

Switchyard prepares deterministic finite wave arrivals and defers a spawn when its entrance has capacity pressure. Moonline Express continuously chooses randomized spawn intervals based on elapsed shift time. Core runtime/sequence/schedule has implemented advance/setPaused/setScale services and residual-time schedule contracts.

Result: the universal timing owner already exists in Core. Authored spawn recipes and capacity policies remain game-specific. A future authorized adapter should reuse that owner rather than create a competing Arcade scheduler. No current game is silently migrated by this review.

## Decision

Three Arcade candidates remain deferred. Universal runtime and elapsed scheduling are Core-owned; authored railway content remains game-specific. No runtime Kit is extracted in this change. This is a grounded source audit and rejection of premature extraction, not proof of a shared runtime contract or a completed optional-Kit implementation.

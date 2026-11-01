# Switchyard quality review and repair

Outcome: make the existing Switchyard candidate ready for actual browser review and the authorized Website installation path.

## Finding and repair

Native Canvas review exposed destination labels overflowing their platform cards, particularly MAGENTA. This is a clarity/accessibility defect. The review returned to implementation rather than declaring the candidate ready.

Both source and build now constrain destination names and the terminal caption to the existing platform width, preserving symbols, words, station positions and game behavior. A focused renderer test checks every label and width. The host comparison now requires pixel equality outside the intentionally repaired station-label rows and proves a real visible change within those rows. The original input remains untouched.

## Evidence boundary

Ten Happy DOM/native Canvas checks passed again, including keyboard dispatch, signals, pause, HUD, hidden-tab recovery, viewport projection, lifecycle cleanup and scoped visual parity. The attached image shows the corrected destination labels. This is not browser CSS, actual human playtesting, physical mobile or installer evidence.

The user declined the external preview service. The canonical Sandbox Rendering & Validation Guide was read and its local browser route executed against this candidate. The local server started, but Chromium failed before rendering with process_singleton_posix.cc socket() failed: Operation not permitted. Mesa software rendering was requested; no renderer identity or browser screenshot was obtained. This is an environment blocker, not an observed game failure. No registry or Website publication is part of this repair commit. The release-quality decision remains open until the relevant interaction and delivery evidence exists.

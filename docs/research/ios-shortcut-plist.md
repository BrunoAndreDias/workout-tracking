# The iOS Shortcut plist for the Apple Watch import

Research date: 2026-10-07  
Scope: what `server/healthShortcut.ts` writes into the Shortcut `Instalar atalho` serves, action by action, and where each part comes from. Nothing here has run on an iPhone.

## Decision summary

The Shortcut uses six Shortcuts actions: Find Health Samples, Repeat with Each, Get Details of Health Sample, Format Date, Get Contents of URL and End Repeat. For each metric it finds the samples of the last 15 days grouped by day, newest first, limited to 15. Then, for each day sample, it posts one flat JSON object `{ "date", "metric", "value" }`. That is today plus the 14 days before, so a run that was skipped for days still fills them in. Four choices follow from the sources:

- **Group by day instead of Calculate Statistics.** Find Health Samples has a `Group by` parameter. Summing raw samples would count steps from both devices twice. The decompiled action shows ActionKit grouping the fetched samples into day buckets itself (`fhs.m`), so whether the sum de-duplicates iPhone and Watch steps the way HealthKit statistics would is now unconfirmed. An earlier version of this note claimed HealthKit statistics did the merge.
- **Sort and limit instead of a calendar window.** A rolling 15-day window can start mid-day, so its oldest day bucket may be partial. ActionKit groups first, then applies the query's sort descriptors and slice to the grouped items. Newest first with a limit of 15 keeps today and the 14 days before, and drops the partial oldest bucket. This is safe whether the window is rolling or calendar.
- **One flat POST per day and metric.** Shortcuts' JSON request body is reliable for flat key and value pairs; nested arrays of dictionaries are where generated shortcuts break. The server takes one sample on its own, so the Shortcut never builds an array. Posting a day again replaces it, so no date arithmetic or If is needed.
- **No sleep and no stand hours.** Both are category samples. Shortcuts gives a category sample's value only as a localized word (`Stood` is `Tempo de pé` on a Portuguese iPhone, `Asleep` is `A dormir`), so a value filter written in one language misses on a phone in another.

## Sources

Primary, read on this Mac (macOS 26.6.2, Shortcuts 7.0 build 4711):

- **ActionKit's readable Health type table.** The strings `Steps`, `Active Calories`, `Exercise Time`, `Move Time`, `Stand Time`, … `Resting Heart Rate`, … `Stand Hour`, …, then the category values `Stood`, `Idle`, `In Bed`, `Asleep`, `Awake`, `Core`, `Deep`, `REM`, found together in the dyld shared cache (`/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e.05`, after the `WFHealthKitConstants.plist` loader). Their order matches the decompiled dictionary below, so these are the keys Find Health Samples looks a `Type` up in.
- **ActionKit's localizations**, `/System/Library/PrivateFrameworks/ActionKit.framework/Versions/A/Resources/Localizable.loctable`: `Stood (Parameter Value)` is `Tempo de pé` in `pt_PT`, `Asleep` is `A dormir`, and the `Group by` and `Fill Missing` parameter names.
- **Shortcuts.app's `Info.plist`.** `com.apple.shortcut` declares only the `.shortcut` extension, no MIME type, so the server answers `application/octet-stream` with a `.shortcut` file name.
- **`shortcuts sign --mode anyone`.** It takes an XML or binary plist and writes an `AEA1` file. Its auth data holds the signing certificate chain; with the leaf's public key, `aea decrypt -sign-pub` and `aa extract` give back `Shortcut.wflow`. Signing kept all 25 actions byte for byte (checked by decoding), so signing does not validate parameters.

Decompiled ActionKit (iOS 18.2), read on GitHub:

- [`WFFindHealthSamplesAction.m`](https://github.com/EthanArbuckle/iPhone17-1_18.2_22C152_Restore/blob/main/System/Library/PrivateFrameworks/ActionKit.framework/WFFindHealthSamplesAction.m): the parameters `WFHKSampleFilteringGroupBy` (`Minute`, `Hour`, `Day`, …), `WFHKSampleFilteringFillMissing` (default true), `WFHKSampleFilteringUnit` (default: the Health app's preferred unit); the `Type` filter row's enumeration value is the readable type; grouping applies to quantity samples only and takes its range from the query's start and end dates; an empty result with readable sources finishes with no output, and with no source shows "No Samples Found".
- [`WFHKSampleContentItem.m`](https://github.com/EthanArbuckle/iPhone17-1_18.2_22C152_Restore/blob/main/System/Library/PrivateFrameworks/ActionKit.framework/WFHKSampleContentItem.m): a quantity sample coerces to an `NSNumber` in its unit, and its text is that number's `stringValue`; a category sample's `Value` is `WFLocalizedParameterValue(...)`, a localized word; the filterable properties are `Value`, `Start Date`, `End Date`, `Duration`, `Source`.
- [`WFHealthKitHelper.m`](https://github.com/EthanArbuckle/iPhone17-1_18.2_22C152_Restore/blob/main/System/Library/PrivateFrameworks/ActionKit.framework/WFHealthKitHelper.m): `sampleTypeIdentifierFromReadableTypeIdentifier:` looks the `Type` up in `WFHealthKitReadableSampleTypeToSampleTypeIdentifierDictionary`.
- [`WFHealthKitReadableSampleTypeToSampleTypeIdentifierDictionary.m`](https://github.com/SuperChaoM/iPhone15-3_17.6.1_21G101_Restore/blob/main/System/Library/PrivateFrameworks/ActionKit.framework/WFHealthKitReadableSampleTypeToSampleTypeIdentifierDictionary.m) (iOS 17.6.1): the identifiers in order, `StepCount`, `ActiveEnergyBurned`, `AppleExerciseTime`, `AppleMoveTime`, `AppleStandTime`, …

Shortcuts other people generate and run:

- [fcandi/Apple-Health-Sync `generate-shortcut.py`](https://github.com/fcandi/Apple-Health-Sync/blob/main/generate-shortcut.py), with its [README](https://github.com/fcandi/Apple-Health-Sync) and [`docs/PLUGIN_PROTOCOL.md`](https://github.com/fcandi/Apple-Health-Sync/blob/main/docs/PLUGIN_PROTOCOL.md) ("Letzte Validierung: 2026-04-22"): the same pipeline as here (Python builds the plist, `shortcuts sign --mode anyone`, AirDrop to the iPhone). It uses `Steps`, `Resting Heart Rate`, `Active Calories`, `Exercise Time` and `Stand Time` as types, `WFHKSampleFilteringGroupBy: Day`, a `Start Date is in the last N days` row (`Operator 1001`, `Unit 16`), and Adjust Date with `WFAdjustOperation`/`WFDuration`. It notes that HealthKit is unreadable while the iPhone is locked, and that the text of a sample can carry a unit.
- [viticci/shortcuts-playground-plugin](https://github.com/viticci/shortcuts-playground-plugin/tree/2de03bffe4ce8802e06d184931d9e4ec366a2ef2/claude/skills/shortcuts-playground) at `2de03bf`: `HEALTHKIT.md` and `FILTERS.md` (the locked `Type` row with `WFStringSubstitutableState`, `Start Date is today` as `Operator 1002` with `Unit 16`, `is between` as `Operator 1003` with `Date` and `AnotherDate` from an Apple-built sample), `CONTROL_FLOW.md` (If codes from an Apple-built sample, `100` is "has any value"), `ACTIONS.md` and `BEST_PRACTICES.md` (Get Contents of URL keys; flat `WFJSONValues` bodies; nested arrays fall back to a text body). Its `golden-shortcuts/xml` are real exports: `8ab0d398…` has an If with `WFCondition 100` and a `Type: Variable` input, `ef669bcf…` a JSON POST with a nested dictionary and array, `2e0fb675…` dictionary items of `WFItemType 3` holding numbers, and a Format Date with `WFDateFormatStyle: Custom` and the pattern in `WFDateFormat`.
- [Cherri `actions/calendar.cherri`](https://github.com/electrikmilk/cherri/blob/a66db15b7f247f3121726c2a2b72becfeef3d96b/actions/calendar.cherri) at `a66db15`: Adjust Date takes `WFDate`, `WFAdjustOperation` (`Add`, `Subtract`, `Get Start of Day`, …) and `WFDuration` in `sec`, `min`, `hr`, `days`, …; Date with `WFDateActionMode`; Format Date with `WFDateFormatStyle` and `WFDateFormat`. Cherri has no Health actions.

Read and not relied on: [vxnsin's `health-sync.shortcut.xml`](https://github.com/vxnsin/vensin-portfolio-v2/blob/main/scripts/health-sync.shortcut.xml) (a hand-written plist with the obsolete `WFHealthSampleType`, but its `WFItemType 3` for numbers in a dictionary agrees with the exports), and [scpl's Find Health Samples page](https://github.com/pfgithub/scpl/blob/master/docs/actions/findhealthsamples.md) (Shortcuts 2.2 era, class and permissions only). No iCloud-shared shortcut was downloaded.

## Action by action

| Action | What the plist sets | Confidence and source |
|---|---|---|
| Find Health Samples, type | locked `Type` row, `Operator 4`, `Enumeration` `WFStringSubstitutableState` | Confirmed: viticci's iOS export, fcandi, decompiled `readableSampleType`. |
| Find Health Samples, type names | `Stand Time`, `Steps`, `Active Calories`, `Exercise Time`, `Resting Heart Rate` | Confirmed against ActionKit's table on this Mac; fcandi uses the same five. viticci's docs say `Exercise Minutes`, which is not in the table. |
| Find Health Samples, relative date | `Start Date` row, `Operator 1001`, `Values {Unit 16, Number "15"}`: "is in the last 15 days" | Confirmed: fcandi `generate-shortcut.py` (device-validated). |
| Find Health Samples, sort and limit | `WFContentItemSortProperty: Start Date`, `WFContentItemSortOrder: Latest First`, `WFContentItemLimitEnabled: true`, `WFContentItemLimitNumber: 15` (a number) | Decompiled `WFFindHealthSamplesAction.m` (`fhs.m`, around lines 280 to 330 and 505 to 512): samples are grouped into day buckets, then the sort descriptors and the slice apply to the grouped items. No real export with `WFContentItemLimitNumber` was found, so its number type is a guess. |
| Find Health Samples, grouping | `WFHKSampleFilteringGroupBy: Day`, `WFHKSampleFilteringFillMissing: false` | Confirmed: decompiled action and fcandi. |
| Find Health Samples, unit | not set: the Health app's preferred unit | Confirmed default from the decompiled helper. Active Energy in kJ on the phone would arrive as kJ. |
| Repeat with Each, start | `is.workflow.actions.repeat.each`, `GroupingIdentifier`, `WFControlFlowMode 0`, `WFInput` an `ActionOutput` attachment of the Find; no `UUID` | Confirmed: viticci golden exports `8ab0d39826ab4249be58672763caa3ba.xml` and `51cc4e26d1044893a0c3f2f3630cf2d2.xml` at `2de03bffe4ce8802e06d184931d9e4ec366a2ef2`. |
| Get Details of Health Sample | `is.workflow.actions.properties.health.quantity`, `WFContentItemPropertyName: Start Date`, `WFInput` the `Repeat Item` variable | The action and property are device-validated by fcandi `generate-shortcut.py` (`extract_start_date`) on a list. Use on one item of a loop is inferred. A grouped day sample's Start Date is local midnight of its day (decompiled grouping transformer). |
| Repeat Item reference | `{Type: Variable, VariableName: Repeat Item}`, as an input attachment and as the `value` token | Confirmed in the same viticci exports. |
| End Repeat | `repeat.each`, same `GroupingIdentifier`, `WFControlFlowMode 2`, with a `UUID` | Confirmed: the same viticci exports. |
| Get Contents of URL | `WFURL` (literal), `WFHTTPMethod POST`, `WFHTTPBodyType JSON` | Confirmed: a real export, viticci, vxnsin. |
| JSON body | `WFJSONValues` with `date` (`WFItemType 0`, token of Format Date), `metric` (`0`, literal), `value` (`3`, token of the Repeat Item) | Item types confirmed by real exports (`3` holds numbers). That a grouped Health sample in a Number field turns into a JSON number is inferred from its `NSNumber` coercion in the decompiled content item. |
| Top level | `WFWorkflowClientVersion 2602.0.5`, `WFWorkflowMinimumClientVersion 900`, icon, empty types and questions | Confirmed: fcandi; `shortcuts sign` keeps them and fills the rest. |

Each UUID is fixed per position, so one address always builds the same plist. `OutputName` values are labels only; the `OutputUUID` links outputs.

## Open risks for the first run

1. Get Details of Health Sample on the Repeat Item is inferred. If it returns nothing, the date is empty and the server rejects the post.
2. 75 POSTs in one run (5 metrics times 15 days) are untested. A slow or throttled run could stop part way.
3. Whether the "last 15 days" window is rolling or calendar is unconfirmed. The limit of 15 makes either safe.
4. Whether steps from the iPhone and the Watch are de-duplicated by ActionKit's own grouping is unconfirmed (see the decision summary).
5. If the Number field sends the sample as text, the server answers 400 and the metric is missing in the Diário.
6. `WFContentItemLimitNumber` as a number rather than a string has no export behind it.
7. The first run asks for Health access per type, and may ask for local network access for an `http://` address.
8. A run while the iPhone is locked finds no Health data (fcandi).

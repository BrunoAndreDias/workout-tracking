# Block length and rate of progression: research notes

Researched 2026-11-22 for a personal hypertrophy logging app (Treino).

Confidence labels:
- **primary**: Nippard's own words, or a peer-reviewed abstract or position stand read directly.
- **secondary**: someone else's summary or a non-peer-reviewed page.
- **UNCONFIRMED**: I could not check it against a primary source.

How I got the sources:
- Nippard's YouTube words come from caption transcripts on rosetta.to (`rosetta.to/u/jeffnippard/...`). That site is a third party that machine-generates transcripts from captions, so small wording errors are possible. I label these "primary (via transcript)".
- Study abstracts come from the Europe PMC REST API, which mirrors PubMed.
- The ACSM 2009 body text comes from the copy linked in the citation below.
- jeffnippard.com product pages, his paid guides and YouTube's own caption endpoint were not used. Paid-guide copies on Scribd, Studocu and random WordPress hosts are pirated, so I did not open them.

---

## Bottom line (numbers a rule could use)

### Block / mesocycle length

| Rule | Value | Basis |
|---|---|---|
| Default block length (same exercises, same structure) | **6 weeks** (5 hard weeks + 1 deload). Allowed range **4–8 weeks**. | Nippard: keep "most of your exercises and most of your workouts the same for at least a month or two" (2024). Nippard: deload "every 4 to 8 weeks or so" (2025). Athlete survey: deload every **5.6 ± 2.3 weeks** (PMID 38499934). |
| Shortest sensible block | **4 weeks**. Rotating exercises more often than this, and especially every session, is discouraged. | Kassiano 2022 SR (PMID 35438660): "excessive rotation ... (i.e., high frequency of change) may actually hinder muscular adaptations". Baz-Valle 2019 (PMID 31881066): changing exercises every session gave no hypertrophy or strength gain, only a motivation gain. |
| Per-exercise lifespan | Main compound lifts: keep across blocks, potentially **for months up to a year**. Isolation lifts: swap when double progression stalls, typically after **1–2 months**. | Nippard 2022 (intermediates): "stick with any single exercise for one to two months". Nippard 2025: heavy press "stick with that for a year"; for isolation, "rotate in a new exercise and start your progression over". |
| How much to change between blocks | Change **some** exercises, mainly isolation and accessories. Keep the main lifts. Do not change everything. | Kassiano 2022: variation should be systematic, not random. Fonseca 2014 (PMID 24832974): varying exercises at constant intensity gave the best strength gain, with similar overall hypertrophy. Nippard 2025: "swapping out a few exercises, but keeping the overall structure the same". |
| Deload | **1 week** (about 6–7 days) per block. Cut sets by roughly 30–50% and/or add RIR. Keep the same exercises. | Survey: 6.4 ± 1.7 days, every 5.6 ± 2.3 weeks, same exercise selection. Delphi (PMID 37730925): no consensus on a number of weeks; "could be included in each mesocycle". Coleman 2024 (PMID 38274324): a 1-week full break mid-programme did not hurt hypertrophy but slightly reduced strength gains. |
| By training age (my synthesis, not a published rule) | **Beginner (<1 yr): 8–12 weeks** on the same plan, with an optional deload. **Intermediate (1–4 yr): 6–8 weeks** with a deload. **Advanced (4–5+ yr): 4–6 weeks** with a deload, plus specialization blocks of **1–2 months**. | Nippard 2022: beginners simply add weight weekly; intermediates rotate exercises every 1–2 months; advanced lifters use 1–2-month specialization phases. Periodization and undulation benefits appear mainly in trained lifters (Moesgaard 2022, PMID 35044672). Untrained lifters progress well on almost anything (Williams 2017, PMID 28497285). |

### Rate of progression

| Rule | Value | Basis |
|---|---|---|
| When to add load | **Double progression.** Add load when all working sets reach the **top of the rep range**. The stricter ACSM trigger is **1–2 reps above target on 2 consecutive sessions**. Otherwise add reps. | ACSM 2009 (PMID 19204579), evidence category B. Nippard 2023 and 2025 videos. |
| Size of a load jump | **2–10%** of current load. Use **~2–5%** for small-muscle or isolation and upper-body lifts, and **~5–10%** for large-muscle lower-body compounds. In kg, that is the **smallest available increment: about 1–2.5 kg upper or isolation, 2.5–5 kg lower compound**. | ACSM 2009 body text: "2–10% (lower percent for small muscle mass exercises, higher percent increase for large muscle mass exercises)". The NSCA-attributed pound figures (2.5–5 lb upper, 5–10 lb lower for novices) are **UNCONFIRMED** against NSCA's own text. |
| Rep progression alternative | **+1 rep per week** on the same load is a normal intermediate rate. For advanced lifters, **+1 rep on one set** counts as progress. | Nippard 2022 and 2025. Plotkin 2022 (PMID 36199287): rep progression and load progression gave similar hypertrophy and strength in trained lifters. |
| Volume progression | Raise weekly sets by **~2.5–5%**, or add about 1 set at a time. | ACSM 2009 body text: "training volume ... may be gradually increased (e.g., 2.5–5%)". Nippard 2025 (Brad): 1 → 2 → 3 sets per exercise over weeks 1–3 for a returning lifter. |
| Realistic pace, beginner | A load increase **every week, and often every session,** on compounds at the same reps. Session-to-session volume load rose **~1–2.3% per session** in an untrained cohort. Strength rose **~30–50% in year 1**. | Nippard 2022: "add some amount of weight ... each and every week at the same rep count". Nóbrega 2023 (PMID 36515591). Steele 2023 (PMID 35591809, minimal-dose cohort). |
| Realistic pace, intermediate | Load goes up **every 2–4 weeks** per lift. In between, reps go up about 1 per week. | Nippard 2022: "you can't simply add weight ... each and every workout anymore". The 2–4-week figure is my arithmetic: an 8–12 rep range at +1 rep per week. |
| Realistic pace, advanced | **A few % per year** on main lifts. Competitive powerlifters gain about **0.10–0.21 kg per day of total** (about 37–77 kg per year on a roughly 500 kg total, i.e. about 7–15% per year), and stronger lifters gain more slowly. | Latella 2020 (PMID 32865942). Steele 2023: strength gains practically plateau after 1–2 years of minimal-dose training. |
| Compound vs isolation | Compounds can run fixed-rep linear load progression for a while (Nippard: +5–10 lb per week on a heavy press). Isolation lifts **cannot keep adding 5 lb per week** and should use double progression, then be swapped when they stall. | Nippard 2025, "How I Blew Up My Shoulders". |
| Guard-rail for an app (heuristic) | Flag any **single-session load jump above 10%** on the same rep target, since it falls outside ACSM's 2–10% band. Flag **any load increase while reps fell below the bottom of the range**. Treat **no rep or load gain for 2 consecutive sessions** (or 2–3 weeks for advanced lifters) as a plateau, which calls for a deload or an exercise swap. | ACSM 2009 band. The plateau rule is a heuristic used by coaches, not a tested threshold. |
| Injury evidence for "too fast" | **None found.** No acute:chronic workload (ACWR) study in resistance training or powerlifting turned up in a Europe PMC title search. The injury reviews say risk-factor data are almost absent. Any "max % increase" rule is therefore a safety heuristic, not evidence-based. | Aasa 2017 (PMID 27707741). Bengtsson 2024 update (PMID 39650568). |

---

## A. Block / mesocycle length

### A1. What Nippard says

- **Keep most exercises and workouts the same for at least 1–2 months; random switching is a "progress killer".**
  - Video: "The Science Behind Sam Sulek's Training", 2024-02-28. Transcript: https://rosetta.to/u/jeffnippard/the-science-behind-sam-sulek-s-training
  - Quotes: "for the most part you do want to keep most of your exercises and most of your workouts the same for at least a month or two"; "it's really hard to guarantee that you're actually progressing if you're just picking different exercises at random"; "this is truly a progress killer".
  - He allows swaps if an exercise causes pain.
  - Confidence: **primary (via transcript)**.
- **Intermediates: stick with any single exercise for 1–2 months.**
  - Video: "How To Make Gains At Every Fitness Level (ft. Picture Fit)", 2022-05-29. Transcript: https://rosetta.to/u/jeffnippard/how-to-make-gains-at-every-fitness-level-ft-picture-fit
  - Quote: "stick with any single exercise for one to two months". In context this is mostly about isolation work.
  - Advanced lifters: "specialization phases" where "you dedicate one to two months of training to developing just one or two body parts", raising that muscle's volume "by about 20 to 40 percent".
  - Beginners (first 1–2 years): no rotation advice; just add weight weekly.
  - Confidence: **primary (via transcript)**.
  - A summary of the same video says "Consider changing most of your exercises every 2 months or so" (BOXROX, 2022-06-01, https://www.boxrox.com/?p=166371). That wording is the article's paraphrase. Confidence: **secondary**.
- **Some novelty helps, but not constant change.**
  - Video: "How To Train For Pure Muscle Growth", 2023-10-29. Transcript: https://rosetta.to/u/jeffnippard/how-to-train-for-pure-muscle-growth
  - Quotes: "having some exercise variety and Novelty is good for muscle growth"; "doing the same exercises month after month and year after year can get stale".
  - Confidence: **primary (via transcript)**.
- **Compounds kept long-term; isolation swapped when progression stalls; deload every 4–8 weeks.**
  - Video: "How I Blew Up My Shoulders", 2025-12-01. Transcript: https://rosetta.to/u/jeffnippard/how-i-blew-up-my-shoulders
  - On the heavy press: "Stick with that for a year".
  - On deloads: "Every 4 to 8 weeks or so, do a [deload] week where you drop the weight back a bit and don't go quite as hard."
  - On isolation: "Once you max out what you can do on cables, switch to a machine and run a new double progression there."
  - Confidence: **primary (via transcript)**.
- **A 5-week build and a week-6 deload in a linear-periodization example.**
  - Video: "The Perfect Leg Day (According To Science)", 2023-08-07. Transcript: https://rosetta.to/u/jeffnippard/the-perfect-leg-day-according-to-science
  - The deadlift example goes 5 → 4 → 3 → 2 → 1 reps over weeks 1–5 while adding weight, then "take a deload in week six".
  - For a hypertrophy-only goal, "just stick with five reps the whole way through" and add weight or improve technique week to week.
  - Confidence: **primary (via transcript)**.
- **Between phases: change a few exercises, keep the structure.**
  - Video: "How Much Muscle Did I Gain In 365 Days?", 2025-05-04. Transcript: https://rosetta.to/u/jeffnippard/how-much-muscle-did-i-gain-in-365-days-scientific-experiment
  - Quote: "swapping out a few exercises, but keeping the overall structure the same".
  - His phases there ran for months (about 6-month bulk, 3-month recomp), not fixed short blocks.
  - Confidence: **primary (via transcript)**.
- **Pick a variant and stay on it until you have got stronger.**
  - Video: "The Only 25 Exercises You Ever Need", 2026-01-13. Transcript: https://rosetta.to/u/jeffnippard/the-only-25-exercises-you-ever-need
  - Quote: "find an angle that feels good for you, stick to it, and get gradually stronger at that incline before switching it up".
  - Confidence: **primary (via transcript)**.
- **Phase lengths in his paid programs: UNCONFIRMED.**
  - Programs checked: Pure Bodybuilding, Fundamentals, Min-Max, Essentials and the Bodybuilding Transformation System.
  - The Workout Mag pages (2026) describe 6-week cycles with a week-6 deload, or 2 × 6-week mesocycles. The Pure Bodybuilding article says its own tables are "constructed using the same scientific principles" and are **not** Nippard's published plan:
    - https://theworkoutmag.com/programs/jeff-nippard-pure-bodybuilding-program-review
    - https://theworkoutmag.com/training-guide/jeff-nippard-bodybuilding-transformation-system-review
  - Confidence: **secondary, low**. Do not use these as "Nippard's numbers".
  - A search snippet says his Fundamentals manual warns that week-to-week exercise changes "flatten out the strength progression curve" and suggests switching after 8 weeks. That claim only surfaced via unauthorized PDF copies, which I did not open. **UNCONFIRMED.**
- **The Muscle Ladder (2024 book):** it covers deloads, training status and progressive overload, but I found no legitimately accessible text giving week counts. **UNCONFIRMED.**

### A2. What research says

- **Kassiano et al. 2022**, "Does Varying Resistance Exercises Promote Superior Muscle Hypertrophy and Strength Gains? A Systematic Review", J Strength Cond Res 36(6):1753–62. **PMID 35438660**.
  - 8 studies, 241 young men.
  - "Some degree of systematic variation seems to enhance regional hypertrophic adaptations and maximize dynamic strength, whereas excessive, random variation may compromise muscular gains ... excessive rotation of different exercises (i.e., high frequency of change), may actually hinder muscular adaptations."
  - It gives no specific week count.
  - Confidence: **primary**.
- **Fonseca et al. 2014**, "Changes in exercises are more effective than in loading schemes to improve muscle strength", J Strength Cond Res. **PMID 24832974**.
  - 12 weeks, twice a week.
  - Whole-quadriceps CSA rose similarly in all groups (about 9.5–12%).
  - The varied-exercise groups grew all quadriceps heads. The constant-exercise group did not grow vastus medialis or rectus femoris.
  - Constant intensity with varied exercise gave the largest squat 1RM gains.
  - Confidence: **primary**.
  - How often exercises were rotated within the 12 weeks is not in the abstract. **UNCONFIRMED** (I believe it was block-wise, not per session, but did not verify).
- **Baz-Valle et al. 2019**, "The effects of exercise variation in muscle thickness, maximal strength and motivation in resistance trained men", PLoS One. **PMID 31881066**.
  - 8 weeks in trained men, comparing fixed exercises with exercises randomized **every session** by an app.
  - Similar 1RM and muscle thickness overall. Vastus intermedius grew significantly only in the fixed group. Motivation improved only in the varied group.
  - Confidence: **primary**.
- **Res Q Exerc Sport 2026**, "Changes in Upper-Limb Lean Tissue Mass in the Early Stages of Resistance Training: The Role of Volume Progression and Exercise Variation". **PMID 41985475**.
  - Novices: 6 standard weeks, then 8 weeks comparing exercise variation, higher volume and both combined.
  - No condition beat the control (all about 2–3% lean mass gain), "likely because all protocols employed sufficient volume and high effort".
  - Suggests variation adds little for beginners.
  - Confidence: **primary**.
- **Periodization:**
  - Williams et al. 2017, Sports Med. **PMID 28497285**. Periodized training beat non-periodized training for 1RM (ES 0.43). Improvements in 1RM were greater in untrained participants. Confidence: **primary**.
  - Moesgaard et al. 2022, Sports Med. **PMID 35044672**. In volume-equated designs, periodization helped 1RM (ES 0.31) but not hypertrophy (ES 0.13, n.s.). Undulating beat linear periodization only in trained lifters. Confidence: **primary**.
  - ACSM 2026 overview of reviews (updates the 2009 stand), Med Sci Sports Exerc. **PMID 41843416**. "Training to momentary muscle fatigue, equipment type, exercise complexity, set structure, time under tension, blood flow restriction, and periodization did not consistently impact training outcomes." Hypertrophy was enhanced by ≥10 sets per week. Confidence: **primary**.
  - Takeaway: for hypertrophy, the exact block structure matters less than consistent progressive overload and enough volume.
- **Deload timing:**
  - Bell et al. 2024, "Deloading Practices in Strength and Physique Sports: A Cross-sectional Survey", Sports Med Open. **PMID 38499934**.
    - 246 competitive athletes with 8.2 ± 6.2 years of training.
    - A deload lasted **6.4 ± 1.7 days** and came **every 5.6 ± 2.3 weeks**.
    - Volume and load were reduced and RIR increased. Frequency and exercise selection were kept the same.
    - Confidence: **primary**. This is descriptive practice, not an outcome trial.
  - Bell et al. 2023, Delphi consensus, Sports Med Open 9:87. **PMID 37730925**.
    - No consensus on a number of weeks. Agreed statements include "Deloading could be included in each mesocycle" and "Deload frequency may depend on how athlete responds".
    - "Every 4–6 weeks" appears only in the paper's background, not as a consensus statement.
    - Confidence: **primary**.
  - Coleman et al. 2024, "Gaining more from doing less? ... one-week deload", PeerJ. **PMID 38274324**.
    - A 1-week full stop at the midpoint of 9 weeks.
    - No difference in hypertrophy. Smaller lower-body strength gains than continuous training.
    - Confidence: **primary**.
- **ACSM 2009 position stand.** **PMID 19204579**.
  - Recommends variation (periodization) for long-term progression and says "systematic variation of volume and intensity is most effective". It gives no exercise-rotation interval.
  - Novice: 8–12 RM. Intermediate (about 6 months of training) to advanced: 1–12 RM periodized.
  - Body text read from https://sfu.ca/~ryand/kin343/ACSMresistance.pdf, the course-hosted copy of the open position stand.
  - Confidence: **primary**.

### A3. Does it differ by training age?

- **Beginners** gain from nearly any consistent program.
  - Nippard 2022: in the first 1–2 years, just add weight weekly.
  - The 2026 novice trial found no benefit from variation (PMID 41985475).
  - Williams 2017 found greater 1RM improvements in untrained lifters.
  - Implication: beginners can keep one plan longer (8–12+ weeks) and change it only when it stalls.
- **Intermediates**: Nippard says rotate exercises every 1–2 months and move to rep-based progression.
- **Advanced**:
  - Trained lifters benefit more from undulation for strength (Moesgaard 2022).
  - Nippard uses 1–2-month specialization phases.
  - Deloads every 4–8 weeks (Nippard 2025). Survey athletes averaged about 5.6 weeks (8 years' training).
- The beginner / intermediate / advanced week counts in the Bottom line are **my synthesis** from these sources. They are not a published rule.

---


The rate of progression, part B, is in [progression-rate.md](./progression-rate.md).

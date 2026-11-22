# The Suggested Target follows a RIR table, and the hardest set decides

Each done set at the last load is read against the RIR Target it aimed at: inside it, or no RIR logged, gives +1 rep; above it (easy) +2; below it but short of failure the same reps; RIR 0 −1. The set giving the fewest reps decides, so every set gets the same kg × reps. When the next target differs from the last, the reps shift by the difference between their lower ends, and never rise more than 2 over the lowest done reps. Past the top of the rep range the load goes up one step ([ADR-0003](0003-load-step.md)), below the bottom down one, and the reps at the new load are re-estimated with Epley. Bodyweight sets move only their reps. The number of sets is always the plan's.

We chose this over the old "reps + RIR − target" arithmetic because that one moved reps by every point of RIR, so a fine effort at RIR 3 on a 1–3 target added two reps and a set to failure counted much like a slightly hard one (`docs/research/progression-rate.md`).

## Consequences

- The reason line names the deciding set's RIR and the target it aimed at, and the cause when that decided. A change of target reads "Semana leve: alvo RIR X." going into a light block, "Volta ao alvo RIR X." coming out, and "Novo alvo: RIR X." for any other change, such as a new Role or a session from before RIR Targets that aimed at its single old RIR. Whether a target was light comes from the flag the session kept, never from its numbers.
- A session that kept no target never aimed at a light one, so it is read against the Role's normal target, even when the next session is in a light block.

# Light blocks replace the per-week RIR

A Training Block has only a length, 6 weeks by default, and a light switch ("Semana leve") for deloads. A light block moves every Role's RIR Target 2 further from failure, and a copied block keeps the switch. Nippard deloads every 4–8 weeks, so the default sits inside that range (`docs/research/block-length-and-progression.md`).

## Considered Options

- **Keeping a RIR target per week, or a ramp across the block.** Rejected with [ADR-0001](0001-rir-targets-per-role.md): effort comes from the Role, and a deload needs only one switch, not a target for every week.

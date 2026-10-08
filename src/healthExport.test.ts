import { describe, expect, it } from 'vitest'
import { readHealthExport } from './healthExport.ts'
import { buildZip } from './zipFixture.ts'

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="pt_PT">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio do Bruno" unit="count" startDate="2026-10-06 08:00:00 +0100" value="120"/>
${' <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="72"/>\n'.repeat(2000)} <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="41.2" durationUnit="min" startDate="2026-10-05 19:10:00 +0100">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="3.4" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="180" unit="kcal"/>
 </Workout>
</HealthData>
`
const WALK = { id: '2026-10-05T18:10:00Z Walking', date: '2026-10-05', start: '19:10', activity: 'Walking', minutes: 41.2, kcal: 180, km: 3.4 }
const CDA = '<ClinicalDocument><Workout workoutActivityType="HKWorkoutActivityTypeYoga" duration="5" durationUnit="min" startDate="2026-10-01 07:00:00 +0100"/></ClinicalDocument>'

describe('reading the Health export file', () => {
  it('streams export.xml out of export.zip, leaving export_cda.xml and the routes alone, and reports progress up to 1', async () => {
    const zip = buildZip([
      { name: 'apple_health_export/export_cda.xml', data: CDA },
      { name: 'apple_health_export/export.xml', data: XML },
      { name: 'apple_health_export/workout-routes/route_2026-10-05.gpx', data: '<gpx/>', method: 0 },
    ])
    const progress: number[] = []
    expect(await readHealthExport(zip, (share) => progress.push(share))).toEqual({ workouts: [WALK], skipped: 0 })
    expect(progress.at(-1)).toBe(1)
  })

  it('reads a Zip64 export.zip and a bare export.xml alike', async () => {
    const zip64 = buildZip([{ name: 'apple_health_export/export.xml', data: XML, zip64: true }])
    expect(await readHealthExport(zip64)).toEqual({ workouts: [WALK], skipped: 0 })
    expect(await readHealthExport(new Blob([XML]))).toEqual({ workouts: [WALK], skipped: 0 })
  })

  it('rejects a zip with no export.xml and a deflated entry that is cut short', async () => {
    await expect(readHealthExport(buildZip([{ name: 'fotos/praia.jpg', data: 'jpg' }]))).rejects.toThrow('O zip não tem o export.xml. Escolhe o export.zip que o Saúde criou.')
    const whole = new Uint8Array(await buildZip([{ name: 'apple_health_export/export.xml', data: XML }]).arrayBuffer())
    const broken = whole.slice()
    broken.fill(0xff, 80, 120)
    await expect(readHealthExport(new Blob([broken]))).rejects.toThrow('Não deu para ler o ficheiro até ao fim. Exporta outra vez no iPhone e tenta de novo.')
  })
})

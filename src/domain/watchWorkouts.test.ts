import { describe, expect, it } from 'vitest'
import type { IsoDate } from './types.ts'
import { activityLabel, exportReader, upsertWatchWorkouts, watchWorkoutsOn } from './watchWorkouts.ts'
import type { ExportRead } from './watchWorkouts.ts'

const EXPORT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT Workout ((MetadataEntry|WorkoutEvent|WorkoutRoute|WorkoutStatistics)*)>
<!ATTLIST Workout workoutActivityType CDATA #REQUIRED>
]>
<HealthData locale="pt_PT">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-10-06 08:00:00 +0100" endDate="2026-10-06 08:10:00 +0100" value="120"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="52.3" durationUnit="min" sourceName="Apple Watch de Bruno > pulso" sourceVersion="11.0" startDate="2026-10-06 18:02:11 +0100" endDate="2026-10-06 18:54:29 +0100">
  <MetadataEntry key="HKIndoorWorkout" value="1"/>
  <WorkoutEvent type="HKWorkoutEventTypePause" date="2026-10-06 18:20:00 +0100" duration="0" durationUnit="min"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-10-06 18:02:11 +0100" endDate="2026-10-06 18:54:29 +0100" sum="310.5" unit="kcal"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" average="121" minimum="80" maximum="160" unit="count/min"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="1800" durationUnit="s" totalDistance="3.1" totalDistanceUnit="mi" totalEnergyBurned="1300" totalEnergyBurnedUnit="kJ" startDate="2026-10-04 07:30:00 +0100" endDate="2026-10-04 08:00:00 +0100"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="1.5" durationUnit="hr" totalDistance="0" totalDistanceUnit="km" startDate="2026-10-05 10:00:00 +0100" endDate="2026-10-05 11:30:00 +0100">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling" sum="42000" unit="m"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="900" unit="kcal"/>
  <WorkoutRoute sourceName="Apple Watch"><FileReference path="/workout-routes/route_2026-10-05.gpx"/></WorkoutRoute>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeYoga" durationUnit="min" startDate="2026-10-05 21:00:00 +0100" endDate="2026-10-05 21:30:00 +0100"/>
 <Workout workoutActivityType="Yoga" duration="10" durationUnit="min" startDate="ontem"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-10-06 20:00:00 +0100" endDate="2026-10-06 20:10:00 +0100" value="80"/>
</HealthData>
`

const EXPECTED = {
  workouts: [
    { id: '2026-10-04T06:30:00Z Running', date: '2026-10-04', start: '07:30', activity: 'Running', minutes: 30, kcal: 310.7, km: 4.99 },
    { id: '2026-10-05T09:00:00Z Cycling', date: '2026-10-05', start: '10:00', activity: 'Cycling', minutes: 90, kcal: 900, km: 42 },
    { id: '2026-10-06T17:02:11Z TraditionalStrengthTraining', date: '2026-10-06', start: '18:02', activity: 'TraditionalStrengthTraining', minutes: 52.3, kcal: 310.5 },
  ],
  skipped: 2,
}

function readInChunks(text: string, size: number): ExportRead {
  const reader = exportReader()
  for (let i = 0; i < text.length; i += size) reader.push(text.slice(i, i + size))
  return reader.finish()
}

describe('reading workouts from the Health export', () => {
  it('reads each Workout, converting s, hr, kJ and mi, and counts the ones it cannot read', () => {
    expect(readInChunks(EXPORT_XML, EXPORT_XML.length)).toEqual(EXPECTED)
  })

  it.each([1, 2, 7, 9, 64, 333])('reads the same when the text arrives in chunks of %i characters', (size) => {
    expect(readInChunks(EXPORT_XML, size)).toEqual(EXPECTED)
  })

  it('keeps the date and time as written, and the id of the same instant from an export in another zone', () => {
    const elsewhere = '<Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="52.3" durationUnit="min" startDate="2026-10-06 19:02:11 +0200"/>'
    expect(readInChunks(elsewhere, 50).workouts).toEqual([
      { id: '2026-10-06T17:02:11Z TraditionalStrengthTraining', date: '2026-10-06', start: '19:02', activity: 'TraditionalStrengthTraining', minutes: 52.3 },
    ])
  })

  it('takes a multisport workout’s own totals, not those of each leg', () => {
    const triathlon = `<Workout workoutActivityType="HKWorkoutActivityTypeSwimBikeRun" duration="120" durationUnit="min" startDate="2026-09-01 08:00:00 +0100">
      <WorkoutActivity uuid="1" startDate="2026-09-01 08:00:00 +0100" duration="30" durationUnit="min">
        <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceSwimming" sum="1500" unit="m"/>
      </WorkoutActivity>
      <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceSwimming" sum="1500" unit="m"/>
      <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling" sum="40" unit="km"/>
      <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="1500" unit="Cal"/>
    </Workout>`
    expect(readInChunks(triathlon, 10).workouts).toEqual([
      { id: '2026-09-01T07:00:00Z SwimBikeRun', date: '2026-09-01', start: '08:00', activity: 'SwimBikeRun', minutes: 120, kcal: 1500, km: 41.5 },
    ])
  })

  it('skips a Workout the file ends inside of', () => {
    expect(readInChunks('<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="5" durationUnit="min" startDate="2026-10-01 07:00:00 +0100">', 8)).toEqual({ workouts: [], skipped: 1 })
  })
})

describe('watch workout log', () => {
  const { workouts } = readInChunks(EXPORT_XML, 4096)

  it('importing the same export twice changes nothing, and a newer read of an id replaces it', () => {
    const once = upsertWatchWorkouts({}, workouts)
    expect(upsertWatchWorkouts(once, workouts)).toEqual(once)
    const longer = upsertWatchWorkouts(once, [{ ...workouts[0], minutes: 31 }])
    expect(Object.values(longer).map((w) => w.minutes)).toEqual([31, 90, 52.3])
  })

  it('lists one date’s workouts by start', () => {
    const log = upsertWatchWorkouts({}, [...workouts, { ...workouts[2], id: 'late' as (typeof workouts)[number]['id'], start: '07:15' }])
    expect(watchWorkoutsOn(log, '2026-10-06' as IsoDate).map((w) => w.start)).toEqual(['07:15', '18:02'])
  })

  it('names an activity in Portuguese, or splits a name it does not know into words', () => {
    expect([activityLabel('TraditionalStrengthTraining'), activityLabel('HighIntensityIntervalTraining'), activityLabel('PaddleSports')]).toEqual(['Força tradicional', 'HIIT', 'Paddle sports'])
  })
})

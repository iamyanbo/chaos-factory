# Blade Brawl

Named neon fighters bounce inside an elastic circle with a seeded Sword, Dagger,
Spear or Hammer. Body hits reduce the bold central HP and grow that weapon;
weapon clashes reverse both spins. A visible shrinking wall closes the fight
after 40s. Boss mode gives the host a larger ball and two weapons, while FFA and
Faction modes finish with the last fighter or team. All four weapon upgrades,
including the Boss's, have the caps in doc21; MAX appears beside a capped stat.
Speed is 180px/s. Only a kill freezes play (80ms, no more often than every .75s).
Hits flash white, shake by at most 3px, and add at most 1.5 radii of extra travel.
Boss HP is round(bossHpPerChatter * viewers), with one constant for all rosters.
The raw 200-seed balance result at each required size is `qa/blade-boss-balance.md`.
At 150 s, visible sudden death shrinks the same physical arena from 300 to
120 px over 12 s. The larger Boss still fits beside a chatter at that radius.
Existing weapon contacts decide the last survivor; there is no clock verdict,
periodic HP loss, invisible push or wall damage. The sidebar names sudden death
without displaying a round timer. HP stays at 55 per chatter; balance is measured
in the raw-seed report rather than assumed to be 50/50.

Boss mode has a visible rage bar. Taking damage equal to 14% of starting HP
fills it and grants five seconds of 1.5× weapon damage. Gold weapons and a gold
ring show the active power; the bar drains during those five seconds. Damage
taken while raging cannot recharge it. Movement, knockback and weapon upgrade
caps stay unchanged. FFA and Faction fighters do not receive rage.

Open `/play?game=blade-brawl`. Choose Boss, FFA or Faction, select the offline
bot count (up to 32 viewers), and start. The host has no reflex controls. Real
viewers use `!join` before lock; the seeded simulation handles every fighter.
The shared best-take selector searches the same locked field before playback.

Doc22 hype observes real weapon hits and kills. Consecutive hits by one attacker
feed the shared combo; a lethal final-duel blade approach can trigger live slow
motion; the actual rule-deciding kill supplies a fallback if a fast sweep skipped
the narrow anticipation band. A leader (highest HP fraction) or crowned fighter narrowly clearing a
lethal drawn blade within 0.3 radius gets SO CLOSE. A crowned victim's actual
elimination gets DETHRONED. On an independently armed third of seeds, the first
kill by an upgraded weapon (at least two landed hits) earns a cosmetic jackpot.
It adds no damage, power or wager reward and consumes none of the combat RNG.
The shared result layer supplies the winner payoff once.

The authenticated broadcaster display name appears on their fighter, HP card,
round cards. Offline practice may read that public name
from the local server without joining chat; otherwise it uses Streamer. Rage
shows a plain percentage while charging and seconds while active.

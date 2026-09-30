# Turkish subtitles for the licensed film catalog

Run `npm run prepare:subtitles` from the repository root. The build validates complete translations, preserves the source cue times and writes `published/*.vtt` plus `published/tracks.json`. Web export copies these files into `dist/media/subtitles`. Nine tracks contain 377 cues across five films; the fifth Tears of Steel part contains credits and has no speech cues.

| Film | Timing/source | Turkish preparation | Published tracks |
|---|---|---|---|
| Sintel | [Commons Turkish TimedText](https://commons.wikimedia.org/wiki/TimedText:Sintel_movie_-_Blender_Fondation.ogv.tr.srt) | Existing translation with a spelling correction | 1 / 26 cues |
| Elephants Dream | [Commons English TimedText](https://commons.wikimedia.org/wiki/TimedText:Elephants_Dream_(2006).webm.en.srt) | Complete 85-cue Turkish translation, including lines missing from the original partial Turkish sidecar | 1 / 85 cues |
| Cosmos Laundromat | [Commons English TimedText](https://commons.wikimedia.org/wiki/TimedText:Cosmos_Laundromat_-_First_Cycle_-_Official_Blender_Foundation_release.webm.en.srt) | Complete Turkish translation of dialogue and sound descriptions | 1 / 109 cues |
| Sprite Fright | [Commons English TimedText](https://commons.wikimedia.org/wiki/TimedText:Sprite_Fright_-_Blender_Open_Movie-full_movie.webm.en.srt) | Complete Turkish translation | 1 / 80 cues |
| Tears of Steel | [acornmediaplayer Turkish SRT](https://github.com/ghinda/acornmediaplayer/blob/gh-pages/subs/TOS-turkish.srt) and [English SRT](https://github.com/ghinda/acornmediaplayer/blob/gh-pages/subs/TOS-english.srt) | Corrected spelling and two empty exclamation cues; timestamps shifted and clamped to the original episode cuts | 5 / 77 cues after boundary splitting |

Commons sidecar contributors are credited through each source page's complete revision history; source revisions are retained in `sources.json` and `english-sources.json`. These sidecars and the published Turkish adaptations use [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The original Turkish source files are retained for attribution and comparison; partially untranslated originals are not published directly.

The Tears of Steel sidecars are from Cristian-Ioan Colceriu and the acornmediaplayer contributors. Their original MIT notice is retained in `ACORN-LICENSE.txt` and embedded in all five published files. The film itself is CC BY 3.0. The other film licenses remain as recorded in `docs/blender-film-catalog.json`; subtitle licensing does not change a film's license.

Original films: Blender Foundation and their open movie teams. Changes: Turkish translations/corrections, line wrapping and episode-relative cue timing by DraBornSeries. Exact cue text and source clocks are inspectable in the tracked source files; no speech-recognition service is claimed. Nonverbal films and Glass Half's fictional language receive no invented dialogue.

// What the local renderer can actually draw. LLM output and user edits are validated against this
// so a scene can never reference a prop/character/background that does not exist.
import { PROP_KEYS } from '../art/props.js';
import { BACKGROUND_KEYS } from '../art/backgrounds.js';
import { CHARACTERS, EMOTIONS } from '../art/characters.js';
import { ANIMAL_KEYS } from '../art/animals.js';

export const CHARACTER_SLUGS = Object.keys(CHARACTERS);
export const BACKGROUNDS = BACKGROUND_KEYS;
export const PROPS = PROP_KEYS;
export const ANIMALS = ANIMAL_KEYS;
export const EMOTION_KEYS = EMOTIONS;

export const ANIMS = ['none', 'bob', 'pop', 'slide_left', 'slide_right', 'slide_up', 'wiggle', 'float', 'pulse'];
export const CAMERA_MOVES = ['none', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right'];
export const TRANSITIONS = ['fade', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleopen', 'dissolve', 'none'];
export const SFX = ['pop', 'chime', 'whoosh', 'sparkle', 'boing', 'tada'];
export const MEDIA_TYPES = ['motion_graphics', 'animated_still', 'ai_video_clip', 'imported_video'];
export const SCENE_KINDS = ['intro', 'lesson', 'recap', 'outro', 'story', 'song', 'other'];

export const CATEGORIES = [
  { id: 'colors', label: 'Colours', labelAr: 'الألوان' },
  { id: 'numbers', label: 'Numbers & counting', labelAr: 'الأرقام والعدّ' },
  { id: 'alphabet', label: 'Alphabet (Arabic / English)', labelAr: 'الحروف' },
  { id: 'shapes', label: 'Shapes', labelAr: 'الأشكال' },
  { id: 'animals', label: 'Animals & their sounds', labelAr: 'الحيوانات وأصواتها' },
  { id: 'nature', label: 'Basic science & nature', labelAr: 'العلوم والطبيعة' },
  { id: 'story', label: 'Educational stories', labelAr: 'قصص تعليمية' },
  { id: 'habits', label: 'Good habits, hygiene, kindness', labelAr: 'العادات الجميلة' },
  { id: 'general', label: 'General knowledge', labelAr: 'معلومات عامة' },
  { id: 'songs', label: 'Educational songs', labelAr: 'أغانٍ تعليمية' },
];

export const VISUAL_STYLES = ['flat-friendly', 'soft-pastel', 'bold-bright'];
export const NARRATION_STYLES = ['warm-teacher', 'playful-friend', 'calm-storyteller'];
export const DIFFICULTIES = ['easy', 'medium', 'challenging'];
export const FORMATS = {
  landscape: { id: 'landscape', label: 'YouTube landscape 16:9', width: 1920, height: 1080 },
  shorts: { id: 'shorts', label: 'YouTube Shorts 9:16', width: 1080, height: 1920 },
};

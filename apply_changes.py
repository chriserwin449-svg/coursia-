#!/usr/bin/env python3
import re

# ===== Task A: Update i18n.ts hero/subtitle =====
with open('/home/z/my-project/src/lib/i18n.ts', 'r') as f:
    content = f.read()

# FR hero + subtitle
content = content.replace(
    'hero: "Tu n\'as pas besoin de plus de contenu. Tu as besoin d\'un cours qui s\'adapte à toi."',
    'hero: "L\'IA qui crée votre cours parfait en quelques secondes."'
)
content = content.replace(
    'subtitle: "Coursia crée des leçons dynamiques, claires et engageantes pour t\'aider à progresser sans te perdre."',
    'subtitle: "Plus besoin de chercher parmi des milliers de vidéos ou de formations. Décrivez simplement ce que vous voulez apprendre, et Coursia construit un parcours complet adapté à vous."'
)

# EN hero + subtitle
content = content.replace(
    'hero: "You don\'t need more content. You need a course that adapts to you."',
    'hero: "The AI that creates your perfect course in seconds."'
)
content = content.replace(
    'subtitle: "Coursia creates dynamic, clear, and engaging lessons to help you progress without getting lost."',
    'subtitle: "No need to search through thousands of videos or courses. Simply describe what you want to learn, and Coursia builds a complete learning path tailored to you."'
)

with open('/home/z/my-project/src/lib/i18n.ts', 'w') as f:
    f.write(content)

print("Task A: i18n.ts hero/subtitle updated")

# ===== Task B: Update TopBar.tsx =====
with open('/home/z/my-project/src/components/coursia/TopBar.tsx', 'r') as f:
    content = f.read()

# Remove randomLang state
content = content.replace(
    '  const [randomLang, setRandomLang] = useState<"fr" | "en">(lang);\n',
    ''
)

# Remove updateLang function (the one in TopBar, not the lang toggle)
content = content.replace(
    '''  const updateLang = (newLang: "fr" | "en") => {
    setLang(newLang);
    setRandomLang(newLang);
  };
''',
    ''
)

# In generateRandom, use lang instead of randomLang
content = content.replace(
    'setRandomCourseLang(randomLang);',
    'setRandomCourseLang(lang);'
)

# Remove the language buttons and divider from the random topic group
old_random_group = '''      <div className="flex items-center rounded-2xl glass overflow-hidden">
        <button
          onClick={() => setRandomLang("fr")}
          className={`px-2.5 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            randomLang === "fr"
              ? "bg-mauve/20 text-mauve-light"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🇫🇷
        </button>
        <button
          onClick={() => setRandomLang("en")}
          className={`px-2.5 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            randomLang === "en"
              ? "bg-mauve/20 text-mauve-light"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🇬🇧
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button'''

new_random_group = '''      <div className="flex items-center rounded-2xl glass overflow-hidden">
        <button'''

content = content.replace(old_random_group, new_random_group)

# Update the UI language toggle to not use updateLang (since we removed it)
# It should just use setLang directly
content = content.replace(
    'onClick={() => updateLang(lang === "fr" ? "en" : "fr")}',
    'onClick={() => setLang(lang === "fr" ? "en" : "fr")}'
)

with open('/home/z/my-project/src/components/coursia/TopBar.tsx', 'w') as f:
    f.write(content)

print("Task B: TopBar.tsx cleaned up")

print("\nAll tasks completed successfully!")

// 💬 회화 — 취미 카테고리의 하위 주제 풀. 취미는 넓은 범위를 다루도록 다른 카테고리보다 하위 선택지가 많다.
// (categories.js의 topics.js와 형식 동일: id/scene/opening. 파일을 분리해 topics.js 길이를 관리한다.)

// 🎵 음악
export const hobbyMusicTopics = [
  { id: "hob-music-genre", title: "Your music taste", scene: "You and a friend are passing an aux cord back and forth, sharing songs.", opening: "Okay, your turn to pick a song. What are you into these days? I feel like your music taste says a lot about you." },
  { id: "hob-music-concert", title: "A live show", scene: "A friend just got back from a concert and is still buzzing about it.", opening: "That show last night was unreal — I lost my voice. When's the last time you saw live music? Who would you kill to see in concert?" },
  { id: "hob-music-instrument", title: "Playing an instrument", scene: "You notice a guitar in the corner of a friend's room and they catch you looking.", opening: "Oh, you play? Or want to? I've been teaching myself for a few months. Do you play anything, or wish you did?" },
  { id: "hob-music-nostalgia", title: "Songs that take you back", scene: "An old song comes on the café speakers and your friend gasps.", opening: "No way, this song! This is straight out of my childhood. Is there a song that instantly takes you back somewhere? What is it?" },
  { id: "hob-music-discover", title: "Finding new music", scene: "A friend asks how you always seem to know the good new songs first.", opening: "How do you always find music before everyone else? I'm so bored of my playlist. Where do you even discover new stuff?" },
];

// ⚽ 스포츠
export const hobbySportsTopics = [
  { id: "hob-sport-fav", title: "The sport you love", scene: "A friend in a team jersey asks what you're into when it comes to sports.", opening: "Big game tonight! Are you into sports at all? What's your thing — playing, watching, or both? I could talk about this for hours." },
  { id: "hob-sport-team", title: "Your favorite team", scene: "You spot a friend wearing your rival team's colors and grin.", opening: "Oh, we are NOT going to get along if you cheer for them. Who's your team? Please tell me you have one — I need someone to argue with." },
  { id: "hob-sport-start", title: "Picking up a new sport", scene: "A friend just came back sweaty and thrilled from trying a new sport.", opening: "I just tried rock climbing for the first time and I'm hooked! Is there a sport you've always wanted to try but never have? Let's do it." },
  { id: "hob-sport-workout", title: "Staying active", scene: "You run into a friend at the park mid-jog and they slow down to chat.", opening: "Trying to get my steps in! Do you work out much, or is that not your thing? I keep trying to find something I actually enjoy." },
  { id: "hob-sport-watch", title: "Watching the big match", scene: "You're settling in with a friend to watch a huge match on TV.", opening: "Okay, kickoff in five! Grab a seat. Are you a nervous watcher or a calm one? I literally cannot sit still during a close game." },
];

// 🎮 게임
export const hobbyGameTopics = [
  { id: "hob-game-fav", title: "Your favorite game", scene: "A friend hands you a controller and asks what you've been playing lately.", opening: "Player two! What have you been playing lately? I need a new game to sink into — what's worth my time right now?" },
  { id: "hob-game-genre", title: "The kind of games you like", scene: "You and a friend are browsing a game store, disagreeing playfully.", opening: "See, I'm all about story games, but you look like a competitive-shooter type. What genre are you really into? Let's settle this." },
  { id: "hob-game-nostalgia", title: "Games from your childhood", scene: "A retro console at a friend's place sparks a wave of nostalgia.", opening: "No way, you still have this?! I grew up on these. What was the first game that really hooked you as a kid?" },
  { id: "hob-game-multiplayer", title: "Playing together", scene: "A friend invites you to team up online tonight.", opening: "We should squad up tonight! Are you more of a play-with-friends person or a solo grinder? I'm terrible alone, honestly." },
  { id: "hob-game-esports", title: "Watching esports", scene: "A big tournament is streaming and your friend is glued to the screen.", opening: "This final is insane — did you see that play?! Do you watch competitive gaming, or is that too much for you? I'm obsessed." },
];

// 🎬 영화·드라마
export const hobbyMovieTopics = [
  { id: "hob-movie-fav", title: "Your favorite movies", scene: "You and a friend are scrolling through a streaming app, unable to agree on anything.", opening: "We've been scrolling for twenty minutes! Okay, what's a movie you could watch a hundred times? Let's start there." },
  { id: "hob-movie-binge", title: "A show you're binge-watching", scene: "A friend looks exhausted and admits they stayed up way too late watching something.", opening: "I only meant to watch one episode... it's 3 a.m. now. Are you watching anything right now? Please tell me it's just as bad for you." },
  { id: "hob-movie-genre", title: "Movie genres you love (or hate)", scene: "You're at the theater lobby, debating what to see next.", opening: "Okay, horror or comedy tonight? I need to know your taste before I trust your pick. What genre could you never get into?" },
  { id: "hob-movie-actor", title: "A favorite actor or director", scene: "A friend just found out an actor they love has a new film coming out.", opening: "Did you hear? My favorite director has a new movie dropping soon! Is there an actor or director you always follow, no matter what?" },
  { id: "hob-movie-review", title: "A movie that disappointed you", scene: "You just left the theater with a friend, both a little underwhelmed.", opening: "Well... that was not what the trailer promised. Has a movie ever let you down that hard? What happened?" },
];

// 📚 독서
export const hobbyReadingTopics = [
  { id: "hob-read-current", title: "What you're reading now", scene: "A friend spots the book poking out of your bag and gets curious.", opening: "Oh, what are you reading? I'm always looking for my next book. Is it any good so far?" },
  { id: "hob-read-genre", title: "Genres you love", scene: "You're browsing shelves at a bookstore with a friend, pulling books out at random.", opening: "Fantasy, mystery, or something real? I could spend all day in here. What kind of books do you always end up gravitating toward?" },
  { id: "hob-read-favorite", title: "A book that changed how you think", scene: "Over coffee, a friend brings up a book that really stuck with them.", opening: "There's this one book I still think about constantly. Has a book ever actually changed the way you see something?" },
  { id: "hob-read-habit", title: "Building a reading habit", scene: "A friend admits they used to read a lot but have completely stopped lately.", opening: "I used to finish a book a week, now I can't remember the last one I read. How do you actually keep up a reading habit?" },
  { id: "hob-read-format", title: "Physical books vs. e-books", scene: "A friend shows off their new e-reader, clearly proud of it.", opening: "I finally switched to one of these. Are you team paper book or team screen? I feel like people get really opinionated about this." },
];

// 🍳 요리
export const hobbyCookingTopics = [
  { id: "hob-cook-signature", title: "Your go-to dish", scene: "A friend asks what you'd cook if you wanted to impress someone.", opening: "If you had to cook one dish to impress someone, what would it be? I need to know your signature move." },
  { id: "hob-cook-learning", title: "Learning to cook", scene: "A friend just burned dinner again and laughs it off while ordering takeout.", opening: "Okay, dinner is officially ruined. How did you learn to cook, actually? Because clearly I need lessons." },
  { id: "hob-cook-cuisine", title: "Cuisines you love", scene: "You're deciding where to eat with a friend, scrolling through delivery apps.", opening: "I could eat spicy food every single day. Is there a type of cuisine you're completely obsessed with? Or one you just can't do?" },
  { id: "hob-cook-baking", title: "Baking adventures", scene: "A friend proudly shows you a slightly lopsided cake they just made.", opening: "Behold — my masterpiece. It tastes better than it looks, I promise. Do you ever bake, or is that a step too far for you?" },
  { id: "hob-cook-family-recipe", title: "A family recipe", scene: "A friend mentions a dish that always reminds them of home.", opening: "There's this dish my family always makes and it just tastes like home to me. Is there a recipe like that for you?" },
];

// 🎨 미술
export const hobbyArtTopics = [
  { id: "hob-art-medium", title: "How you like to create", scene: "A friend is sketching in a notebook while waiting for you at a café.", opening: "Oh, don't stop on my account — that's really good. Do you draw a lot? What kind of art are you into making, or just looking at?" },
  { id: "hob-art-inspiration", title: "What inspires you", scene: "You're both wandering through a gallery, pausing at different pieces.", opening: "This one's stopped me in my tracks. What kind of stuff actually inspires you creatively? I feel like everyone has different triggers." },
  { id: "hob-art-start", title: "Wanting to try art", scene: "A friend admits they've always wanted to pick up a creative hobby but never have.", opening: "I've always wanted to try painting but I'm scared I'll be terrible at it. Is there an art form you've always wanted to try?" },
  { id: "hob-art-favorite-artist", title: "A favorite artist", scene: "A friend shows you a print they just bought for their room.", opening: "I just bought this for my wall — I love their style so much. Do you have an artist whose work you always come back to?" },
  { id: "hob-art-digital", title: "Digital vs. traditional art", scene: "A friend is showing off a digital drawing they made on a tablet.", opening: "I did this all on my tablet — no paint anywhere near it. Do you prefer digital art, or does it feel like cheating to you?" },
];

// 📷 사진
export const hobbyPhotoTopics = [
  { id: "hob-photo-camera", title: "Phone vs. real camera", scene: "A friend is fiddling with a proper camera at a scenic overlook while you reach for your phone.", opening: "You brought the actual camera again? Do you think it's really worth carrying around, or is a phone good enough these days?" },
  { id: "hob-photo-subject", title: "What you love to photograph", scene: "You're both wandering the city with cameras out, stopping at random things.", opening: "Okay, what do you actually love taking pictures of? People, food, random street stuff? I feel like everyone has a thing." },
  { id: "hob-photo-editing", title: "Editing your photos", scene: "A friend is scrolling through edited versions of the same photo, comparing them.", opening: "I spent way too long editing this one shot. Do you edit your photos a lot, or do you like keeping things more natural?" },
  { id: "hob-photo-memorable", title: "A photo you're proud of", scene: "A friend pulls up their camera roll to show you a shot they're especially proud of.", opening: "Okay, this is probably my favorite photo I've ever taken. Do you have one like that? What makes it special to you?" },
  { id: "hob-photo-social", title: "Sharing photos online", scene: "A friend hesitates before posting a new photo, thinking out loud.", opening: "I don't know, should I post this one or not? Do you share your photos much, or do you keep most of them just for yourself?" },
];

// ✈️ 여행
export const hobbyTravelTopics = [
  { id: "hob-travel-style", title: "How you like to travel", scene: "A friend is packing for a trip, deciding between a strict itinerary and total spontaneity.", opening: "Do I plan every hour, or just wing it when I get there? Are you a planner when you travel, or more of a go-with-the-flow person?" },
  { id: "hob-travel-memorable", title: "Your most memorable trip", scene: "You and a friend are flipping through old travel photos together.", opening: "Okay, out of everywhere you've been, what trip stands out the most? Something that still feels unreal when you think about it." },
  { id: "hob-travel-bucket", title: "Places on your bucket list", scene: "A friend is watching travel videos and sighing wistfully.", opening: "I need to go here someday, I swear. What's the top place on your travel bucket list? The one you'd drop everything for." },
  { id: "hob-travel-solo", title: "Solo travel", scene: "A friend is nervously considering a trip completely on their own for the first time.", opening: "I'm thinking about traveling alone for the first time and I'm honestly a little scared. Have you ever traveled solo? How was it?" },
  { id: "hob-travel-local", title: "Exploring your own city", scene: "A visiting friend asks you to show them around like a local.", opening: "Okay, you know this city — where would you actually take a friend visiting for the first time? Not the touristy stuff, the real spots." },
];

// 🐾 반려동물
export const hobbyPetsTopics = [
  { id: "hob-pet-intro", title: "Your pet (or dream pet)", scene: "A friend is showing you photos of their pet, scrolling endlessly.", opening: "Okay, I have about a hundred more photos, sorry. Do you have any pets? Or if not, what would your dream pet be?" },
  { id: "hob-pet-story", title: "A funny pet story", scene: "A friend's pet just did something ridiculous, and they're still laughing about it.", opening: "You would not believe what my dog just did. Do you have any ridiculous pet stories? I need to hear one to feel less crazy." },
  { id: "hob-pet-choosing", title: "Thinking about getting a pet", scene: "A friend is seriously considering adopting a pet and wants your opinion.", opening: "I've been thinking about finally getting a pet, but I don't know if I'm ready. Do you think I could handle it? What would you get?" },
  { id: "hob-pet-type", title: "Dog person or cat person", scene: "You and a friend pass both a dog park and a cat café on the same street.", opening: "Okay, be honest — dog person or cat person? I feel like this says everything about someone." },
  { id: "hob-pet-care", title: "Caring for a pet", scene: "A friend looks a little tired after a long night with a sick pet.", opening: "My pet kept me up half the night, but I wouldn't trade it. How much work do you think having a pet really is, day to day?" },
];

// 🏕 아웃도어
export const hobbyOutdoorTopics = [
  { id: "hob-outdoor-hike", title: "Hiking and trails", scene: "You and a friend reach a scenic viewpoint partway up a trail, both a little out of breath.", opening: "Worth every step, right? Do you hike much? I'm always looking for a good new trail to try." },
  { id: "hob-outdoor-camp", title: "Camping trips", scene: "A friend is packing gear for a weekend camping trip and asks for your take.", opening: "Tent camping or cabin — no in-between for me. Do you like camping, or does sleeping outside sound like a nightmare to you?" },
  { id: "hob-outdoor-nature", title: "Why you love being outside", scene: "You're both taking a break on a bench, surrounded by trees and fresh air.", opening: "I really needed this — being outside just resets my whole mood. What is it about nature that gets you, if anything?" },
  { id: "hob-outdoor-gear", title: "Outdoor gear obsession", scene: "A friend proudly unpacks a bag full of new hiking gear.", opening: "Okay, don't judge me, but I may have bought too much gear for one trip. Do you get into the gear side of outdoor stuff too?" },
  { id: "hob-outdoor-adventure", title: "An outdoor adventure gone wrong", scene: "Over dinner, a friend starts telling a story about an outdoor trip that didn't go as planned.", opening: "So there we were, completely lost with no signal... it's a good story now, at least. Ever had an outdoor trip go sideways on you?" },
];

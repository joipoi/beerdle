# Description

This is a game in the style of wordle but for guessing beers. You get one beer per day or something and you guess what it is. When you guess wrong you get clues until you get it right. I want to host this on github pages so I can easily share it later.

This is a hobby project I am working on for my dad and his friends. They are really into beer and know a lot about beer, some of them work at breweries or pubs. They are also swedish so the game text should be in swedish. They also use untappd but rating beers, thought about including data from there but they don't have a good public API.

# Data source

I am getting my beer data from the swedish alcohol store "Systembolaget". They don't have a public APi but somebody made a tool that gets the data. You don't really need to know about this tool, I got the data and then extracted the parts I think are useful for this game. I left an example of the full data object in "Full_Beer_Data_Example.json" The tools was written in GO and is over here: https://github.com/AlexGustafsson/systembolaget-api

# TO-DO

The game already has a demo that kinda works. I can improve it in lots of small ways but I'm unsure I like it currently. Maybe I should start from scratch or I need ideas. I am also not sure I am using the data in the best way.
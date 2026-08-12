https://www.reddit.com/r/AI_Agents/comments/1u6bndt/ive_been_building_voice_agents_for_3_years_here/
Tutorial
Spent a lot of time this week putting together everything I know about voice AI prompting and figured I'd share the core stuff here before the full breakdown goes live.

Most voice agent prompts I've seen (including my own early ones) make the same mistakes. The agent sounds robotic, says things no human would ever say, or just makes stuff up when it doesn't know the answer.

A few things that actually moved the needle for me:

Read your prompt out loud before you deploy. Sounds dumb, works every time. You'll catch sentences that are way too long, instructions that contradict each other, and transitions that make zero sense when spoken. Five minutes of this saves hours of post-launch call review.

Explicitly tell the agent to use filler words. Ummm, uhh, like, so... put it in the prompt directly. When an agent responds instantly with perfect grammar every single time it feels off. Uncanny valley. One line in the prompt fixes this.

Show don't tell. Don't write "be empathetic when the caller is frustrated." Write: "if the caller sounds frustrated, say something like: 'I totally get that, that would frustrate me too, let me sort this out right now.'" Actual example in the prompt beats ten paragraphs of description.

Handle special characters explicitly. Your agent doesn't know how to say "$1,000" or "123 Main Street" or "john@gmail.com" unless you tell it. Digit by digit for addresses, "one thousand dollars" for currency, "john dot smith at gmail dot com" for emails. These feel minor until you hear them on a real call.

Give permission to say I don't know. Without this instruction, the model will guess. And in voice AI that's way worse than in a chatbot because people just believe what they hear. One line: "if you don't have this information, do not guess, say you'll connect them with a team member."

There are a few more, including one about prompt length and latency that I think a lot of builders overlook.

Put the full list with example prompt snippets for each one in a video if anyone wants to go deeper, link in comments.

Happy to answer questions here too.

here is the workflow:
https://www.youtube.com/watch?v=XeMT-6c5ySI&feature=youtu.be
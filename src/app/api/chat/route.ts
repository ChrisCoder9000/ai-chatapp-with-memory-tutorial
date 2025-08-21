// -- /api/chat/ POST

import { LumenBrainDriver } from "@lumenlabs/lumen-brain";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { message, memoryId, conversationId } = await req.json();

    if (!process.env.BRAINAPI_API_KEY || !process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ message: "Server Error" }), {
        status: 500,
      });
    }

    const brain = new LumenBrainDriver(process.env.BRAINAPI_API_KEY);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    await brain.saveMessage(memoryId, message.content, "user", conversationId);

    const brainResponse = await brain.queryMemory(
      message.content,
      memoryId,
      conversationId
    );

    const additionalContext = brainResponse.context;

    const prompt = message.content + additionalContext;

    const stream = await openai.responses.create({
      model: "gpt-4o",
      input: prompt,
      stream: true,
    });

    let aiResponse = "";

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "response.output_text.delta") {
              const content = chunk.delta;
              if (content) {
                aiResponse += content;
                const data = `data: ${JSON.stringify({
                  content,
                  conversationId,
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          await brain.saveMessage(
            memoryId,
            aiResponse,
            "assistant",
            conversationId
          );
        } catch (err) {
          console.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.log(err);
    return new Response(
      JSON.stringify({
        message: "Error",
      }),
      { status: 500 }
    );
  }
}

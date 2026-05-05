import { z } from "zod";

export const songSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required"),
  category: z.string().optional(),
  key: z.string().optional(),
  tempo: z.number().int().positive().optional(),
  artist: z.string().optional(),
  year: z.string().optional(),
  tags: z.string().optional(),
  content: z.string().min(1, "ChordPro content is required"),
  isDraft: z.boolean().default(false),
});

export const songVariationSchema = z.object({
  id: z.string().uuid().optional(),
  songId: z.string().uuid(),
  name: z.string().min(1, "Variation name required"),
  content: z.string().min(1),
  key: z.string().optional(),
});

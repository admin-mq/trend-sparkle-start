
CREATE TABLE public.amcue_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.amcue_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.amcue_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  context_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amcue_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amcue_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations" ON public.amcue_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON public.amcue_messages FOR ALL TO authenticated USING (conversation_id IN (SELECT id FROM public.amcue_conversations WHERE user_id = auth.uid())) WITH CHECK (conversation_id IN (SELECT id FROM public.amcue_conversations WHERE user_id = auth.uid()));

CREATE TRIGGER update_amcue_conversations_updated_at BEFORE UPDATE ON public.amcue_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

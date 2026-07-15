-- Chorale audio streaming schema with private, streaming-only storage access

CREATE OR REPLACE FUNCTION public.is_admin_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND is_admin = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  performance_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performances_published_sort
  ON public.performances (is_published, sort_order, performance_date DESC);

CREATE TABLE IF NOT EXISTS public.rehearsal_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID NOT NULL REFERENCES public.performances(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  composer TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  storage_bucket TEXT NOT NULL DEFAULT 'chorale-audio' CHECK (storage_bucket = 'chorale-audio'),
  storage_object_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_tracks_performance_sort
  ON public.rehearsal_tracks (performance_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rehearsal_tracks_published
  ON public.rehearsal_tracks (is_published);

ALTER TABLE public.performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view published performances" ON public.performances;
CREATE POLICY "Authenticated users can view published performances"
  ON public.performances
  FOR SELECT
  TO authenticated
  USING (is_published = TRUE OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert performances" ON public.performances;
CREATE POLICY "Admins can insert performances"
  ON public.performances
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update performances" ON public.performances;
CREATE POLICY "Admins can update performances"
  ON public.performances
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete performances" ON public.performances;
CREATE POLICY "Admins can delete performances"
  ON public.performances
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view published rehearsal tracks" ON public.rehearsal_tracks;
CREATE POLICY "Authenticated users can view published rehearsal tracks"
  ON public.rehearsal_tracks
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    OR (
      is_published = TRUE
      AND EXISTS (
        SELECT 1
        FROM public.performances
        WHERE performances.id = rehearsal_tracks.performance_id
          AND performances.is_published = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert rehearsal tracks" ON public.rehearsal_tracks;
CREATE POLICY "Admins can insert rehearsal tracks"
  ON public.rehearsal_tracks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update rehearsal tracks" ON public.rehearsal_tracks;
CREATE POLICY "Admins can update rehearsal tracks"
  ON public.rehearsal_tracks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rehearsal tracks" ON public.rehearsal_tracks;
CREATE POLICY "Admins can delete rehearsal tracks"
  ON public.rehearsal_tracks
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('chorale-audio', 'chorale-audio', FALSE)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Storage policy setup guidance:
-- 1) Keep bucket private and do not create public URL policies.
-- 2) Admin users may upload/update/delete objects in the bucket.
-- 3) Members do not receive direct storage object read policies; playback uses short-lived signed URLs generated server-side.
-- 4) Supabase service role can sign playback URLs and bypasses RLS.


DROP POLICY IF EXISTS "Admins can upload chorale audio objects" ON storage.objects;
CREATE POLICY "Admins can upload chorale audio objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chorale-audio'
    AND public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update chorale audio objects" ON storage.objects;
CREATE POLICY "Admins can update chorale audio objects"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chorale-audio'
    AND public.is_admin_user(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'chorale-audio'
    AND public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete chorale audio objects" ON storage.objects;
CREATE POLICY "Admins can delete chorale audio objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chorale-audio'
    AND public.is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "perfil_dono_manage" ON public.perfil;

CREATE POLICY "perfil_dono_insert" ON public.perfil
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_minha_empresa_id()
  AND public.get_meu_papel() = 'dono'
);

CREATE POLICY "perfil_dono_update" ON public.perfil
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_minha_empresa_id()
  AND public.get_meu_papel() = 'dono'
)
WITH CHECK (
  empresa_id = public.get_minha_empresa_id()
  AND public.get_meu_papel() = 'dono'
);

CREATE POLICY "perfil_dono_delete" ON public.perfil
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_minha_empresa_id()
  AND public.get_meu_papel() = 'dono'
);

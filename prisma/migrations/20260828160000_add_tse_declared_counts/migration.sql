-- Quantos bens e quantas candidaturas anteriores a FICHA do TSE declara.
--
-- POR QUE UMA CONTAGEM, E POR QUE ANULÁVEL
--
-- Hoje três situações diferentes colapsam no banco numa só ("nenhuma linha de
-- patrimônio / de histórico"): a ficha nunca foi lida, a ficha respondeu sem a
-- lista, e a ficha respondeu com a lista VAZIA. Só a terceira autoriza a página
-- a afirmar, sobre uma pessoa real, que o TSE não lista bem algum — e sem
-- registrar esse sinal a redação tinha de recuar para algo mais fraco do que a
-- evidência sustenta em 38 das 211 candidaturas (bens) e 41 (histórico).
--
-- Contagem, não booleano: uma ficha pode listar N bens e mesmo assim não
-- gravar linha alguma (item sem data é descartado na escrita), e um booleano
-- diria "a lista veio" enquanto a página voltaria a afirmar "não lista bem
-- algum". Com a contagem, N > 0 e zero linhas exibidas é um terceiro caso, com
-- redação própria.
--
-- SEM `DEFAULT 0`: `0` é a afirmação, não a ausência dela. Carimbar zero faria
-- o banco alegar "declara zero bens" sobre as 211 candidaturas antes que
-- qualquer ficha fosse lida. Pelo mesmo motivo não há backfill: as colunas
-- nascem NULL e só o sync, ao ler a ficha, as preenche.
--
-- Aditivo: o sync completo roda 4x/dia contra este mesmo banco e não pode
-- falhar linha a linha por coluna obrigatória recém-criada.

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "tseAssetsDeclared" INTEGER,
ADD COLUMN     "tsePriorElectionsDeclared" INTEGER;

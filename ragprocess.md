Ok now lets built the rag system no ? IF the route
  is rag . since there is this 2 shti such as
  expanded_query which uses proper EYD language as an
  interogative question and then the
  rag_optimized_query wich used as  a query to the
  chromadb. and then When we take the snippet we need
  to add a parser to expand the content as +1 after the
  content . If the content is the first index then it
  uses  with the keys are of the metadatas here the
  shti that i selected with the id is
  {documentcode}_{current_chunk} so to kinda expand the
  context to n+1 we just need to
  documentcode_{current_chunk+1} and then we query
  those after the 2 query are done we need to find the
  overlap and merge the 2 text together since i chnk it
  likewith a n overlap we just neeedto find the
  simmilar string or match stirng that are overlapping
  between the two example are in here  

id
document_code
current_chunk
total_chunks
jenis
nomor
tahun
tentang
tanggal_ditetapkan
tanggal_berlaku
sumber
status
dasar_hukum
view_link
source_file

example of the chunk that i made :

chunk 1 : Kota tata boga merupakan kota yang dibuat un
chunk 2 : buat untuk menjadikan kota dengan industri gandum 

You can see ere {{dibuat un}} match with the 2nd chunk of {{buat untuk .. }}

so the merged doc will be 
kota tata boga merupakan kota yang dibuat untuk menjadikan kota dengan industri gandum

this merged doc then are formatted this way 
remember docnum is pointing to the real document that are queried. so we kept the metadata and such 
[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

For every chunk we take say k=5 we add docnum by ranking of the similarites so [1],[2],[3]. 
and then we put these docs of chunks into an LLM agent to be seen which document are the most relevant. 
when we are searching in to the chroma db please use the {rag_optimized_query}
with the format 
[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

[docnum] 
jenis, nomor, tahun, tentang
...{chunk}...

And then the instruction is please create the proper instruction
{the job is to check the relevance of each chunk  and then kinda based off the  query make sure to allow To accept partially answered questiong}

query : {{expanded_query}} 

and the output format is 

{
  rationale:"string of which document is relevant and such. make sure to be as detauled as possible"
  ids: [list of the ids]
}

and then we parse this all TO only take the ids . 


and then after this we need to take the docnum that are only outputed by the id 
+ its rationale so after that say the ids is [1][3][5]

it will create a context format for the General chat 

with this formatting 
"""
___begin_context__
{the content}
___end_context____

{expanded_query}
"""

and then this will also return not only the rag prompt but also the metadata. 
with the format of [(jenis,nomor,tahun,view_link)] -> this return will render as a pill for the reference 
later its loaded like this [jenis,nomor,tahun]{view_link} -> meaning this view_link is the embedded version .. can we do that  pleae ?
 

Thats the full "pipeline for this rag process"
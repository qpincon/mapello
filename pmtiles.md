# Base tiles
Go to https://maps.protomaps.com/builds/ and copy the download URL of the latest build

Download it:
```
curl --output world.pmtiles "<url>"
```


Upload it to bunny storage
curl --request PUT --url https://storage.bunnycdn.com/cartosvg/world.pmtiles --header "AccessKey: <access_key>" --header "Content-Type: application/octet-stream" --header 'accept: application/json' -T world.pmtiles --progress-bar -o upload.txt

# Elevation polygons
versatiles convert --max-zoom 8 -c gzip "https://download.versatiles.org/hillshade-vectors.versatiles" "hillshade-vectors.pmtiles"
curl --request PUT --url https://storage.bunnycdn.com/cartosvg/hillshade.pmtiles --header "AccessKey: 89933ec8-480c-4bfc-bc63f734c798-1310-4d98" --header "Content-Type: application/octet-stream" --header 'accept: application/json' -T hillshade-vectors.pmtiles --progress-bar -o upload.txt

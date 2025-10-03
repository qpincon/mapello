Go to https://maps.protomaps.com/builds/ and copy the download URL of the latest build

Download it:
```
curl --output world.pmtiles "<url>"
```


Upload it to bunny storage
curl --request PUT --url https://storage.bunnycdn.com/cartosvg/world.pmtiles --header "AccessKey: <access_key>" --header "Content-Type: application/octet-stream" --header 'accept: application/json' -T world.pmtiles --progress-bar -o upload.txt
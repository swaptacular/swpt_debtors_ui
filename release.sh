#!/bin/sh

if [ -z "$1" ]; then
    echo "Usage: release.sh TAG"
    return
fi

swpt_debtors_ui="epandurski/swpt_debtors_ui:$1"
docker build -t "$swpt_debtors_ui" --target app-image .
git tag "v$1"
git push origin "v$1"
docker login
docker push "$swpt_debtors_ui"
